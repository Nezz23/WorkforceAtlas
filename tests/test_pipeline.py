import duckdb
import numpy as np
import pandas as pd
import pytest

from pipeline import build, publish, validate
from tests.conftest import rows

M = 202509


def employment(**over):
    return rows(1, **{"snapshot_yyyymm": str(M), **over})


def separation(category="SC", drp="N", effective=M, **over):
    return rows(1, **{"separation_category_code": category, "drp_indicator": drp,
                      "personnel_action_effective_date_yyyymm": str(effective), **over})


def test_valid_employment_file_passes_and_profiles_pay(write):
    path = write("e", employment() + employment(annualized_adjusted_basic_pay="REDACTED") + employment(
        annualized_adjusted_basic_pay=None))
    profile = validate.check(build.connect(path, M), "employment", M, None)
    assert profile["rows"] == 3 and profile["pay_redacted"] == 1 and profile["pay_null"] == 1
    assert profile["pay_hidden_pct"] == pytest.approx(66.67)


@pytest.mark.parametrize("records, message", [
    (employment(snapshot_yyyymm="202508"), "bad_snapshot=1"),
    (employment(count="2"), "bad_count=1"),
    (employment(length_of_service_years="ten"), "bad_los=1"),
])
def test_broken_employment_contract_stops(write, records, message):
    with pytest.raises(validate.ContractError, match=message):
        validate.check(build.connect(write("e", records), M), "employment", M, None)


def test_missing_column_stops(write):
    records = [{k: v for k, v in r.items() if k != "age_bracket"} for r in employment()]
    with pytest.raises(validate.ContractError, match="missing columns"):
        validate.check(build.connect(write("e", records), M), "employment", M, None)


def test_unmapped_separation_code_stops(write):
    with pytest.raises(validate.ContractError, match="unmapped category codes"):
        validate.check(build.connect(write("s", separation(category="ZZ")), M), "separations", M, None)


def test_future_effective_month_stops(write):
    with pytest.raises(validate.ContractError, match="bad_effective=1"):
        validate.check(build.connect(write("s", separation(effective=M + 1)), M), "separations", M, None)


def test_large_headcount_move_warns_but_passes(write):
    profile = validate.check(build.connect(write("e", employment() * 10), M), "employment", M,
                             {"rows": 100, "pay_hidden_pct": 0.0})
    assert profile["warnings"] == ["rows changed -90.0% from the prior month"]


def test_separation_cube_bands_drp_and_late_actions(write):
    path = write("s", separation() + separation(drp="Y", effective=M - 1, length_of_service_years="0.4")
                 + separation(category="SD", grade="14", length_of_service_years="31"))
    con = build.connect(path, M)
    cube = con.execute((build.SQL / "cube_separations.sql").read_text()).df()
    assert cube["n"].sum() == 3 and cube["late_n"].sum() == 1
    assert set(cube["los_band"]) == {"<1", "3-4", "30+"}
    assert set(cube["grade_band"]) == {"GS 8-12", "GS 13-15"}
    assert cube.loc[cube.drp, "n"].sum() == 1
    assert cube["los_years"].sum() == pytest.approx(35.9)


def test_headcount_cube_counts_only_numeric_pay(write):
    path = write("e", employment() + employment(annualized_adjusted_basic_pay="REDACTED"))
    cube = build.connect(path, M).execute((build.SQL / "cube_headcount.sql").read_text()).df()
    assert (cube["n"].sum(), cube["pay_n"].sum(), cube["pay_sum"].sum()) == (2, 1, 70000.0)


def test_exact_poisson_interval_matches_known_values():
    lo, hi = publish.poisson_ci(pd.Series([0, 10]))
    assert lo[0] == 0 and hi[0] == pytest.approx(3.689, abs=1e-3)
    assert (lo[1], hi[1]) == pytest.approx((4.795, 18.390), abs=1e-3)


def test_reconciliation_arithmetic():
    gov = pd.DataFrame({"month": [1, 2, 3], "headcount": [100, 95, 97], "headcount_prev": [np.nan, 100, 95],
                        "acc_new_hire": [5, 4, 6], "separations": [3, 9, 4]})
    rec = publish.reconciliation(gov)
    assert list(rec["delta_headcount"]) == [-5, 2]
    assert list(rec["gap_same_month"]) == [-5 - (4 - 9), 2 - (6 - 4)]
    assert list(rec["gap_prior_month"]) == [-5 - (5 - 3), 2 - (4 - 9)]
