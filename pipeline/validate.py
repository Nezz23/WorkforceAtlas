"""Data contract for one FWD file. Structural problems stop the build; statistical shifts are recorded as warnings."""
import csv
from pathlib import Path

REF = Path(__file__).resolve().parents[1] / "ref"
COMMON = ["count", "department_code", "department", "agency_code", "agency", "occupational_group_code",
          "occupational_group", "pay_plan_code", "grade", "step_or_rate_type_code", "length_of_service_years",
          "age_bracket", "supervisory_status_code", "annualized_adjusted_basic_pay"]
REQUIRED = {
    "employment": COMMON + ["snapshot_yyyymm"],
    "separations": COMMON + ["separation_category_code", "drp_indicator", "personnel_action_effective_date_yyyymm"],
    "accessions": COMMON + ["accession_category_code", "personnel_action_effective_date_yyyymm"],
}
CATEGORY_COLUMN = {"separations": "separation_category_code", "accessions": "accession_category_code"}
WARN_ROWS_CHANGE = 0.05      # employment only: month-on-month headcount change above 5%
WARN_PAY_HIDDEN_PP = 5.0     # employment only: pay hidden share moving more than 5 percentage points
WARN_UNKNOWN_LOS = 0.08      # flows: unknown length-of-service share above 8% is a warning...
STOP_UNKNOWN_LOS = 0.25      # ...and above 25% stops the build


class ContractError(Exception):
    pass


def known_codes(stream: str) -> set[str]:
    with open(REF / f"{stream[:-1]}_categories.csv") as f:
        return {row["code"] for row in csv.DictReader(f)}


def check(con, stream: str, month: int, previous: dict | None) -> dict:
    """Profile the `src` view, raise ContractError on a broken contract, return the profile with warnings."""
    columns = {r[0] for r in con.execute("describe src").fetchall()}
    missing = sorted(set(REQUIRED[stream]) - columns)
    if missing:
        raise ContractError(f"{stream} {month}: missing columns {missing}")

    extra = {
        "employment": "count(*) filter (where snapshot_yyyymm::int is distinct from _month) as bad_snapshot",
    }.get(stream, """count(*) filter (where try_cast(personnel_action_effective_date_yyyymm as int) is null
                                     or personnel_action_effective_date_yyyymm::int > _month) as bad_effective,
                     count(*) filter (where personnel_action_effective_date_yyyymm::int < _month) as late""")
    cur = con.execute(f"""
        select count(*) as rows,
               count(*) filter (where "count" is distinct from '1') as bad_count,
               count(*) filter (where length_of_service_years is not null and num(length_of_service_years) is null) as bad_los,
               count(*) filter (where length_of_service_years is null) as null_los,
               count(*) filter (where annualized_adjusted_basic_pay = 'REDACTED') as pay_redacted,
               count(*) filter (where annualized_adjusted_basic_pay is null) as pay_null,
               count(*) filter (where num(annualized_adjusted_basic_pay) <= 0) as pay_nonpositive,
               count(*) filter (where department_code is null) as null_department,
               {extra}
        from src""")
    profile = dict(zip([d[0] for d in cur.description], cur.fetchone()))

    errors = [f"{k}={v}" for k, v in profile.items() if k.startswith("bad_") and v]
    if profile["rows"] == 0:
        errors.append("no rows")
    if stream in CATEGORY_COLUMN:
        codes = {r[0] for r in con.execute(f"select distinct {CATEGORY_COLUMN[stream]} from src").fetchall()}
        if unknown := codes - known_codes(stream):
            errors.append(f"unmapped category codes {sorted(unknown, key=str)}: map them in ref/ first")
    if stream == "separations":
        flags = {r[0] for r in con.execute("select distinct drp_indicator from src").fetchall()}
        if flags - {"Y", "N", None}:
            errors.append(f"drp_indicator values {sorted(flags, key=str)}")
    rows = profile["rows"]
    if stream in CATEGORY_COLUMN and rows and profile["null_los"] / rows > STOP_UNKNOWN_LOS:
        errors.append(f"unknown length of service for {profile['null_los'] / rows:.1%} of rows (limit {STOP_UNKNOWN_LOS:.0%})")
    if errors:
        raise ContractError(f"{stream} {month}: " + "; ".join(errors))

    profile["pay_hidden_pct"] = round(100 * (profile["pay_redacted"] + profile["pay_null"]) / rows, 2)
    warnings = []
    if previous:
        if stream == "employment" and abs(rows / previous["rows"] - 1) > WARN_ROWS_CHANGE:
            warnings.append(f"rows changed {rows / previous['rows'] - 1:+.1%} from the prior month")
        if stream == "employment" and abs(profile["pay_hidden_pct"] - previous["pay_hidden_pct"]) > WARN_PAY_HIDDEN_PP:
            warnings.append(f"pay hidden share moved {profile['pay_hidden_pct'] - previous['pay_hidden_pct']:+.1f} pp")
    if profile["null_department"]:
        warnings.append(f"department code missing for {profile['null_department']:,} rows")
    if profile["null_los"] / rows > (WARN_UNKNOWN_LOS if stream in CATEGORY_COLUMN else 0.01):
        warnings.append(f"length of service missing for {profile['null_los'] / rows:.1%} of rows")
    profile["warnings"] = warnings
    return profile
