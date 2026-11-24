"""Model safeguards on synthetic series (not OPM data): no look-ahead, correct life-table arithmetic, spikes flagged."""
import numpy as np
import pandas as pd
import pytest

from models import anomaly, exit_model, forecast, retention
from pipeline import labour, notices


def synthetic_kpi(months=168, spike_at=None, seed=1):
    rng = np.random.default_rng(seed)
    ms, m = [], 201001
    for _ in range(months):
        ms.append(m)
        m = forecast.add_months(m, 1)
    season = 1 + 0.3 * np.sin(np.arange(months) * 2 * np.pi / 12)
    quits = rng.poisson(1000 * season).astype(float)
    if spike_at is not None:
        quits[ms.index(spike_at)] *= 3
    hires = rng.poisson(1100 * season).astype(float)
    sep = quits + 200
    head = 100_000 + np.cumsum(hires - sep)
    zeros = np.zeros(months)
    return pd.DataFrame({"month": ms, "scope": "ALL", "headcount": head, "acc_new_hire": hires, "accessions": hires,
                         "separations": sep, "sep_drp": zeros, "sep_quit": quits, "sep_retirement": zeros + 200,
                         "sep_rif": zeros, "sep_termination": zeros, "sep_transfer": zeros})


def test_add_months_wraps_years():
    assert forecast.add_months(202511, 3) == 202602 and forecast.add_months(202601, -1) == 202512


@pytest.mark.parametrize("method", forecast.METHODS)
def test_forecast_uses_nothing_after_the_origin(method):
    kpi = synthetic_kpi()
    s = forecast.series(kpi, "ALL")
    origin = 202112
    before = forecast.forecast(s, origin, method, steps=12)
    tampered = s.copy()
    tampered.loc[tampered.index > origin, ["H", "A", "S", "gap"]] *= 10
    assert np.allclose(before, forecast.forecast(tampered, origin, method, steps=12))


def test_life_table_chains_constant_hazards():
    surv = retention.curve(np.array([[0.1, 0.1, 0.1, 0.1]]))[0]
    assert len(surv) == 11 and surv[0] == 1 and surv[10] == pytest.approx(np.exp(-1.0))


def test_life_table_holds_each_band_rate_for_its_span():
    surv = retention.curve(np.array([[0.5, 0.0, 0.0, 0.2]]))[0]
    assert surv[1] == pytest.approx(np.exp(-0.5)) and surv[5] == pytest.approx(np.exp(-0.5))   # no exits in years 2-5
    assert surv[10] == pytest.approx(np.exp(-0.5 - 5 * 0.2))


def test_a_tripled_month_is_flagged_and_a_normal_month_is_not():
    kpi = synthetic_kpi(spike_at=202312)
    result = anomaly.run(kpi, ["ALL"], {"ALL": "All"}, set())
    flagged = {(a["flow"], a["month"]) for a in result["alerts_recent"]}
    assert ("sep_quit", 202312) in flagged
    assert ("acc_new_hire", 202312) not in flagged


def test_calibrated_threshold_flags_about_one_percent_of_calm_months():
    result = anomaly.run(synthetic_kpi(), ["ALL"], {"ALL": "All"}, set())
    assert result["calm_flag_rate"] <= 2.0


def test_a_month_opm_reports_incomplete_is_a_gap_not_a_signal():
    kpi = synthetic_kpi(spike_at=202312)
    result = anomaly.run(kpi, ["ALL"], {"ALL": "All"}, {("ALL", 202312, "separations")})
    assert ("sep_quit", 202312) not in {(a["flow"], a["month"]) for a in result["alerts_recent"]}
    assert ("sep_quit", 202312) in {(a["flow"], a["month"]) for a in result["gaps_recent"]}


@pytest.mark.parametrize("method", forecast.METHODS)
def test_flows_and_other_change_add_up_to_the_forecast(method):
    s = forecast.series(synthetic_kpi(), "ALL")
    origin = 202212
    path = forecast.forecast(s, origin, method)
    a, x, _ = forecast.flow_forecast(s.loc[:origin], forecast.H_MAX)
    other = forecast.decompose(path, s.at[origin, "H"], a, x)
    assert np.allclose(s.at[origin, "H"] + np.cumsum(a - x + other), path)


def test_missing_department_flows_are_replaced_by_a_seasonal_estimate():
    dept = synthetic_kpi().assign(scope="AA")
    gov = dept.assign(scope="ALL")                    # one department: the government-wide series equals it
    kpi = pd.concat([gov, dept])
    kpi.loc[(kpi.scope == "AA") & (kpi.month == 202306), "separations"] = 0      # a lost submission
    kpi.loc[(kpi.scope == "ALL") & (kpi.month == 202306), "separations"] -= dept.set_index("month").at[202306, "separations"]
    gaps = notices.unreliable([{"month": 202306, "stream": "separations", "scope": "AA", "status": "active"}])
    for scope in ("AA", "ALL"):
        s = forecast.series(kpi, scope, gaps)
        expected = np.median([dept.set_index("month").at[m, "separations"] for m in (202206, 202106, 202006)])
        assert s.at[202306, "S"] == pytest.approx(expected, rel=0.25)


def test_release_note_bullets_become_department_notices():
    rels = [{"release": "1.0", "date": "2026-11-04", "bullets": [
        "September 2026 datasets were published from EHRI Status, Dynamics, and Payroll data feeds.",
        "There are approximately 10,000 missing records from AR00 Status across the following components: ARAF, DD83."]}]
    found = notices.parse(rels)
    assert found[(202609, "headcount", "DOD")]["records_missing"] == 10000
    assert (202609, "separations", "DOD") not in found
    assert ("ALL", 202609, "headcount") in notices.unreliable(list(found.values()))


def test_department_simulator_flows_ignore_a_one_month_spike():
    s = forecast.series(synthetic_kpi(), "ALL")
    hist = s.loc[:202212].copy()
    calm, _ = forecast.seasonal_flows(hist, 12)
    hist.loc[202212, "A"] *= 20                    # a reorganisation moves a whole office in
    spiked, _ = forecast.seasonal_flows(hist, 12)
    assert spiked.sum() == pytest.approx(calm.sum(), rel=0.02)


def test_a_reworded_gap_bullet_is_surfaced_not_dropped():
    rels = [{"release": "2.0", "date": "2027-01-05", "bullets": [
        "Some records are absent from the EHRI release for NASA this month."]}]
    unparsed = []
    assert notices.parse(rels, unparsed) == {} and len(unparsed) == 1


def test_words_like_ehri_or_nasa_are_not_department_codes():
    assert notices.departments("EHRI Status files from NASA were late; components: NN23, NN10.") == ["NN"]


def _errors(values, start=201512):
    """One level, one horizon: an error per quarterly origin, each known one quarter after its origin."""
    origins = [forecast.add_months(start, 3 * i) for i in range(len(values))]
    return pd.DataFrame({"level": "government-wide", "h": 3, "origin": origins,
                         "target": [forecast.add_months(o, 3) for o in origins], "log_err": values})


def test_adaptive_ranges_widen_after_a_run_of_misses_and_fixed_ranges_do_not():
    rng = np.random.default_rng(3)
    errs = _errors(np.concatenate([rng.normal(0, 0.01, 40), np.linspace(0.03, 0.10, 8)]))   # calm years, then a shift
    fixed, _ = forecast.sequential_bounds(errs, 0.2, adaptive=False)
    adapt, _ = forecast.sequential_bounds(errs, 0.2, adaptive=True)
    after = errs.index[40:]
    assert (adapt.loc[after, "hi"] > fixed.loc[after, "hi"]).any()
    assert (adapt.loc[after, "hi"] >= fixed.loc[after, "hi"] - 1e-12).all()
    calm = errs.index[30]
    assert adapt.at[calm, "hi"] == pytest.approx(fixed.at[calm, "hi"], rel=0.5)


def test_an_interval_never_uses_an_error_from_after_its_origin():
    errs = _errors(np.linspace(-0.02, 0.02, 30))
    b, _ = forecast.sequential_bounds(errs, 0.2, adaptive=True)
    tampered = errs.copy()
    tampered.loc[tampered.index[25:], "log_err"] = 9.0
    t, _ = forecast.sequential_bounds(tampered, 0.2, adaptive=True)
    first = errs.index[errs.origin >= errs.target.iloc[24]][0]           # last origin before any tampered target
    assert np.allclose(b.loc[:first, ["lo", "hi"]].dropna(), t.loc[:first, ["lo", "hi"]].dropna())


def test_quit_rates_average_by_fiscal_year():
    rates = {202410: 2.0, 202411: 3.0, 202509: 4.0, 202510: 1.0}
    fy = labour.by_fiscal_year(rates)
    assert fy[2025] == {"rate": 3.0, "months": 3} and fy[2026] == {"rate": 1.0, "months": 1}


def test_the_labour_market_level_recovers_a_known_slope():
    rng = np.random.default_rng(5)
    quits = {2015 + i: 2.0 + 0.2 * i for i in range(8)}
    fy = np.repeat(list(quits), 200)
    mu = rng.uniform(5, 50, len(fy))                                     # the structural model's expected exits
    q = np.array([quits[y] for y in fy])
    y = rng.poisson(mu * np.exp(0.25 * (q - q.mean())))
    _, b1, se, _ = exit_model.fit_level(pd.DataFrame({"fy": fy, "voluntary": y, "exposure": 1.0}), mu, quits)
    assert abs(b1 - 0.25) < 3 * se + 0.01


def test_a_failed_quit_rate_fetch_keeps_the_last_file(tmp_path, monkeypatch):
    out = tmp_path / "labour_quits.csv"
    out.write_text("month,rate\n202509,2.1\n")
    monkeypatch.setattr(labour, "OUT", out)
    def broken(*a, **k):
        raise ValueError("Expecting value: line 1 column 1")      # malformed JSON from the API
    monkeypatch.setattr(labour, "fetch", broken)
    labour.main()
    assert labour.load(out) == {202509: 2.1}


def test_the_exit_model_refuses_to_run_without_every_training_years_quit_rate():
    with pytest.raises(ValueError, match="quit rate"):
        exit_model.run(quits={2015: 2.0})


def test_a_missing_record_count_goes_to_the_files_its_sentence_names():
    bullet = ("June 2026 datasets were re-published from EHRI Status. There are still approximately 6,211 missing records "
              "from the following components: DD01, DD08. June 2026 Dynamics files reported by data provider DD07 are missing.")
    found = notices.parse([{"release": "1.0", "date": "2026-09-02", "bullets": [bullet]}])
    counts = {k[1]: v["records_missing"] for k, v in found.items()}
    assert counts["headcount"] == 6211 and counts["accessions"] is None and counts["separations"] is None
