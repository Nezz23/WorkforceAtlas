"""Warehouse -> data/published: KPI series with exact Poisson intervals, reconciliation, facts.json, manifest.json.

Every number a narrative may cite is a fact with an id, the months it reads and the rule that produced it.
Nothing here is estimated except where a column or fact says so.

    python -m pipeline.publish
"""
import json
import os
import statistics
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy.stats import chi2

from pipeline.validate import ContractError, STOP_UNKNOWN_LOS, WARN_UNKNOWN_LOS

ROOT = Path(__file__).resolve().parents[1]
SQL, WAREHOUSE, PUBLISHED = ROOT / "sql", ROOT / "data" / "warehouse", ROOT / "data" / "published"
MIN_DENOMINATOR = 30   # rates on fewer people are suppressed ("too few")
ALPHA = 0.05


STREAM_CUBE = {"employment": "headcount", "separations": "separations", "accessions": "accessions"}
NO_DATA = "No Data Reported"   # OPM's department label from 2024-10 for rows with no department: treated as UNKNOWN


def month_range(first: int, last: int) -> list[int]:
    out, m = [], first
    while m <= last:
        out.append(m)
        m = m + 89 if m % 100 == 12 else m + 1
    return out


def assert_complete(months: dict[str, set[int]]) -> None:
    """Every stream has every month from the first to the latest, and all streams end in the same month."""
    problems = []
    latest = {s: max(v) for s, v in months.items() if v}
    if len(latest) < len(months) or len(set(latest.values())) > 1:
        problems.append(f"streams are empty or end in different months: {latest}")
    else:
        first = min(min(v) for v in months.values())
        expected = set(month_range(first, max(latest.values())))
        for s, have in months.items():
            if gap := sorted(expected - have):
                problems.append(f"{s} is missing {len(gap)} months, first {gap[0]}")
    if problems:
        raise ContractError("incomplete warehouse: " + "; ".join(problems))


def warehouse_months(warehouse: Path = WAREHOUSE) -> dict[str, set[int]]:
    return {s: {int(f.stem) for f in (warehouse / cube).glob("*.parquet")} for s, cube in STREAM_CUBE.items()}


def quality_profile(con, warehouse: Path = WAREHOUSE) -> dict:
    """Recomputed from the cubes on every publish, so it cannot go stale. Per stream and month: rows, share with no
    department (null or 'No Data Reported'), unknown length-of-service share (flows), and the flow total against the
    median of the same calendar month in the three previous years (null until three years exist)."""
    out, warnings = {}, {}
    for stream, cube in STREAM_CUBE.items():
        flow = stream != "employment"
        df = con.execute(f"""
            select month, sum(n)::bigint as rows,
                   coalesce(sum(n) filter (where department_code is null or department_code = '{NO_DATA}'), 0) / sum(n) as null_department_share
                   {", coalesce(sum(n) filter (where los_band = 'Unknown'), 0) / sum(n) as unknown_los_share" if flow else ""}
            from read_parquet('{warehouse}/{cube}/*.parquet') group by month order by month""").df()
        total = dict(zip(df.month.astype(int), df.rows.astype(int)))
        out[stream] = {}
        for r in df.to_dict("records"):
            m = int(r["month"])
            entry = {"rows": int(r["rows"]), "null_department_share": round(float(r["null_department_share"]), 5)}
            if flow:
                entry["unknown_los_share"] = round(float(r["unknown_los_share"]), 5)
                prior = [total[m - 100 * k] for k in (1, 2, 3) if m - 100 * k in total]
                entry["median_same_month_3y"] = statistics.median(prior) if len(prior) == 3 else None
                entry["ratio_to_median"] = round(total[m] / entry["median_same_month_3y"], 3) if prior and len(prior) == 3 else None
                if entry["unknown_los_share"] > STOP_UNKNOWN_LOS:
                    raise ContractError(f"{stream} {m}: unknown length of service {entry['unknown_los_share']:.1%} "
                                        f"(limit {STOP_UNKNOWN_LOS:.0%})")
                if entry["unknown_los_share"] > WARN_UNKNOWN_LOS:
                    warnings.setdefault(f"{stream} {m}", []).append(
                        f"length of service unknown for {entry['unknown_los_share']:.1%} of rows")
                if entry["ratio_to_median"] is not None and not 0.5 <= entry["ratio_to_median"] <= 2:
                    warnings.setdefault(f"{stream} {m}", []).append(
                        f"{entry['ratio_to_median']:.2f}x the same-month 3-year median")
            if entry["null_department_share"] > 0:
                warnings.setdefault(f"{stream} {m}", []).append(
                    f"department missing for {entry['null_department_share']:.2%} of rows")
            out[stream][ym(m)] = entry
    return {"streams": out, "warnings": warnings}


def poisson_ci(k: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    """Exact (Garwood) 95% interval for a Poisson count."""
    k = k.to_numpy(dtype=float)
    lo = np.where(k > 0, chi2.ppf(ALPHA / 2, 2 * k) / 2, 0.0)
    return lo, chi2.ppf(1 - ALPHA / 2, 2 * k + 2) / 2


def kpi_monthly(con) -> pd.DataFrame:
    df = con.execute((SQL / "publish_kpi_monthly.sql").read_text()).df()
    flows = [c for c in df.columns if c.startswith(("sep", "acc")) or c == "experience_lost_years"]
    df[flows] = df[flows].fillna(0)
    df["avg_headcount"] = (df["headcount"] + df["headcount_prev"]) / 2
    ok = df["avg_headcount"] >= MIN_DENOMINATOR
    for count, name in [("separations", "sep_rate"), ("sep_voluntary", "sep_voluntary_rate"),
                        ("accessions", "acc_rate"), ("acc_new_hire", "new_hire_rate")]:
        lo, hi = poisson_ci(df[count])
        scale = 1200 / df["avg_headcount"]   # annualized, percent of average headcount
        df[name] = (df[count] * scale).where(ok)
        df[f"{name}_lo"] = (lo * scale).where(ok)
        df[f"{name}_hi"] = (hi * scale).where(ok)
    df["too_few"] = ~ok & df["avg_headcount"].notna()
    df["pay_coverage_pct"] = 100 * df["pay_n"] / df["headcount"]
    return df


def reconciliation(gov: pd.DataFrame) -> pd.DataFrame:
    """Does the headcount change match the flows of the same month, or of the month before?"""
    r = gov[["month", "headcount"]].copy()
    r["delta_headcount"] = gov["headcount"] - gov["headcount_prev"]
    r["net_flow_same_month"] = gov["acc_new_hire"] - gov["separations"]   # government-wide: transfers excluded
    r["net_flow_prior_month"] = r["net_flow_same_month"].shift(1)
    r["gap_same_month"] = r["delta_headcount"] - r["net_flow_same_month"]
    r["gap_prior_month"] = r["delta_headcount"] - r["net_flow_prior_month"]
    return r.dropna(subset=["delta_headcount"])


def pay_gs(con) -> pd.DataFrame:
    df = con.execute((SQL / "publish_pay_gs.sql").read_text()).df()
    df["observed_mean"] = df["observed_sum"] / df["observed_n"]
    df["derived_base_mean"] = df["derived_base_sum"] / df["derived_n"]
    df["coverage_observed_pct"] = 100 * df["observed_n"] / df["n"]
    df["coverage_with_derived_pct"] = 100 * (df["observed_n"] + df["derived_n"]) / df["n"]
    df["observed_over_base_pct"] = 100 * (df["observed_sum_priced"] / df["base_of_observed_sum"] - 1)
    return df.sort_values(["department_code", "grade", "month"]).reset_index(drop=True)


def segments_fy(con) -> pd.DataFrame:
    df = con.execute((SQL / "publish_segments_fy.sql").read_text()).df()
    df = df[df.n_months == 12].copy()   # complete fiscal years only
    ok = df["avg_headcount"] >= MIN_DENOMINATOR
    lo, hi = poisson_ci(df["separations"])
    df["rate"] = (100 * df["separations"] / df["avg_headcount"]).where(ok)
    df["rate_lo"] = (100 * lo / df["avg_headcount"]).where(ok)
    df["rate_hi"] = (100 * hi / df["avg_headcount"]).where(ok)
    df["voluntary_rate"] = (100 * df["voluntary"] / df["avg_headcount"]).where(ok)
    df["drp_rate"] = (100 * df["drp"] / df["avg_headcount"]).where(ok)
    return df.sort_values(["scope", "dimension", "level", "fy"]).reset_index(drop=True)


def ym(month: int) -> str:
    return f"{month // 100}-{month % 100:02d}"


def facts(gov: pd.DataFrame, rec: pd.DataFrame, pay: pd.DataFrame, sources: dict) -> list[dict]:
    g = gov.set_index("month")
    latest = int(g.index.max())
    year_ago = latest - 100
    out = []

    def fact(fid, label, value, unit, months, rule, **extra):
        out.append({"id": fid, "label": label, "value": value, "unit": unit, "months": [ym(m) for m in months],
                    "rule": rule, "kind": "observed", **extra})

    fact("headcount_latest", "Federal civilian headcount (on-board records)", int(g.at[latest, "headcount"]),
         "people", [latest], "Rows in the employment file")
    change = int(g.at[latest, "headcount"] - g.at[year_ago, "headcount"])
    fact("headcount_change_12m", "Headcount change over 12 months", change, "people", [year_ago, latest],
         "H(latest) - H(latest - 12 months)",
         pct=round(100 * change / g.at[year_ago, "headcount"], 2))
    yoy = (g["headcount"] - g["headcount"].shift(12)).dropna()
    fact("headcount_change_12m_rank", "Rank of the latest 12-month change among all 12-month changes since 2012",
         int((yoy < yoy.loc[latest]).sum() + 1), "rank (1 = largest decline)", [int(yoy.index.min()), latest],
         "Rank of H(t) - H(t-12) over every month with a year of history", of=int(len(yoy)))

    peak = int(g["headcount"].idxmax())
    fact("headcount_peak", "Highest monthly headcount since 2012", int(g.at[peak, "headcount"]), "people", [peak],
         "max H(t)")
    fact("headcount_change_from_peak", "Headcount change from the peak to the latest month",
         int(g.at[latest, "headcount"] - g.at[peak, "headcount"]), "people", [peak, latest], "H(latest) - H(peak)",
         pct=round(100 * (g.at[latest, "headcount"] / g.at[peak, "headcount"] - 1), 2))
    fact("headcount_latest_rank_low", "Rank of the latest headcount among all months (1 = lowest)",
         int((g["headcount"] < g.at[latest, "headcount"]).sum() + 1), "rank", [int(g.index.min()), latest],
         "rank of H(latest), ascending", of=int(len(g)))
    worst = int(yoy.idxmin())
    fact("headcount_change_12m_worst", "Largest 12-month headcount decline since 2012", int(yoy.min()), "people",
         [worst - 100, worst], "min of H(t) - H(t-12)")
    fy = g.assign(fy=g.index // 100 + (g.index % 100 >= 10)).groupby("fy")["experience_lost_years"].sum()
    for y in (2024, 2025, 2026):
        fact(f"experience_lost_fy{y}", f"Years of federal service held by people who separated in FY{y}",
             round(float(fy[y])), "years", [(y - 1) * 100 + 10, y * 100 + 9], "sum of length of service over separations")
    sept = g[g.index % 100 == 9]
    base = sept.loc[(sept.index >= 201209) & (sept.index <= 202409), "separations"]
    fact("separations_2025_09", "Separations processed in September 2025 (excluding transfers)",
         int(g.at[202509, "separations"]), "people", [202509], "Separation rows, transfer categories excluded")
    fact("separations_drp_2025_09", "Of which flagged under the deferred resignation program",
         int(g.at[202509, "sep_drp"]), "people", [202509], "drp_indicator = 'Y'")
    fact("separations_september_median_2012_2024", "Median September separations, 2012-2024",
         float(base.median()), "people", list(base.index.astype(int)), "Median over the 13 Septembers")
    fact("separations_2025_09_vs_median", "September 2025 separations as a multiple of the 2012-2024 September median",
         round(g.at[202509, "separations"] / base.median(), 2), "ratio", [202509], "Ratio of the two facts above")

    last12 = g.loc[g.index > year_ago]
    fact("replacement_ratio_12m", "New hires per separation, last 12 months (excluding transfers)",
         round(last12["acc_new_hire"].sum() / last12["separations"].sum(), 3), "ratio",
         [int(last12.index.min()), latest], "sum(new hires) / sum(separations)")
    for col, label in [("sep_rate", "Separation rate"), ("acc_rate", "Accession rate")]:
        fact(f"{col}_latest", f"{label}, latest month, annualized", round(g.at[latest, col], 2), "% per year",
             [latest], "count / average headcount x 12",
             ci=[round(g.at[latest, f"{col}_lo"], 2), round(g.at[latest, f"{col}_hi"], 2)])

    emp = sources["employment"][str(latest)]
    fact("pay_hidden_pct_latest", "Share of employment records with pay redacted or missing",
         emp["pay_hidden_pct"], "%", [latest], "(REDACTED + null) / rows")

    all_gs = pay[(pay.department_code == "ALL") & (pay.grade == "ALL")].set_index("month")
    fact("gs_coverage_observed_pct_latest", "GS records with observed pay", round(all_gs.at[latest, "coverage_observed_pct"], 1),
         "%", [latest], "observed / GS records")
    fact("gs_coverage_with_derived_pct_latest", "GS records with observed or derived base pay",
         round(all_gs.at[latest, "coverage_with_derived_pct"], 1), "%", [latest],
         "(observed + derived) / GS records", kind="derived")
    fact("gs_observed_over_base_pct_latest", "Observed GS pay above the GS base table for the same records (locality and special rates)",
         round(all_gs.at[latest, "observed_over_base_pct"], 1), "%", [latest],
         "sum(observed) / sum(base rate of the same records) - 1")
    span = [int(rec.month.min()), int(rec.month.max())]
    fact("reconciliation_median_abs_gap", "Median absolute gap between headcount change and same-month net flow",
         float(rec["gap_same_month"].abs().median()), "people", span, "median |dH(t) - (A(t) - S(t))|")
    fact("reconciliation_gap_2025_09", "Gap in September 2025: exits processed but still in the September headcount",
         int(rec.set_index("month").at[202509, "gap_same_month"]), "people", [202509], "dH - (A - S)")
    fact("reconciliation_gap_2025_09_10", "Gap over September and October 2025 combined",
         int(rec.set_index("month").loc[[202509, 202510], "gap_same_month"].sum()), "people", [202509, 202510],
         "sum of the two monthly gaps")
    late = sum(v["late"] for s in ("separations", "accessions") for v in sources[s].values())
    total = sum(v["rows"] for s in ("separations", "accessions") for v in sources[s].values())
    fact("late_actions_pct", "Share of flow records processed after their effective month",
         round(100 * late / total, 2), "%", [int(gov.month.min()), latest], "effective month < file month")
    return out


def main() -> None:
    PUBLISHED.mkdir(parents=True, exist_ok=True)
    assert_complete(warehouse_months())
    sources = json.loads((WAREHOUSE / "sources.json").read_text())
    con = duckdb.connect()
    df = kpi_monthly(con)
    gov = df[df.scope == "ALL"].reset_index(drop=True)
    rec = reconciliation(gov)
    pay = pay_gs(con)
    pay.to_parquet(PUBLISHED / "pay_gs.parquet", index=False, compression="zstd")
    seg = segments_fy(con)
    seg.to_parquet(PUBLISHED / "segments_fy.parquet", index=False, compression="zstd")
    occ = con.execute((SQL / "publish_occupation_fy.sql").read_text()).df()
    occ.to_parquet(PUBLISHED / "occupation_fy.parquet", index=False, compression="zstd")
    exposure = con.execute((SQL / "publish_retirement_exposure.sql").read_text()).df()
    exposure["exposed_pct"] = 100 * exposure["exposed"] / exposure["headcount"]
    exposure.to_parquet(PUBLISHED / "retirement_exposure.parquet", index=False, compression="zstd")
    df.to_parquet(PUBLISHED / "kpi_monthly.parquet", index=False, compression="zstd")
    rec.to_parquet(PUBLISHED / "reconciliation.parquet", index=False, compression="zstd")
    con.execute(f"""copy (select dim, code, arg_max(name, month) as name from (
                     select *, parse_filename(filename, true)::int as month
                     from read_parquet('data/warehouse/names/*.parquet', filename = true)) group by all order by all)
                   to '{PUBLISHED / "dim_names.parquet"}' (format parquet)""")
    (PUBLISHED / "facts.json").write_text(json.dumps(facts(gov, rec, pay, sources), indent=1))

    quality = quality_profile(con)
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    (PUBLISHED / "manifest.json").write_text(json.dumps({
        "published_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "code_version": os.environ.get("GITHUB_SHA", "")[:7] or commit.stdout.strip() or None,
        "months": [ym(int(df.month.min())), ym(int(df.month.max()))],
        "sources": {s: {m: {k: v[k] for k in ("version", "publish_date", "rows")} | {"sha256": v.get("sha256")}
                        for m, v in files.items()}
                    for s, files in sources.items()},
        "quality": quality["streams"],
        "warnings": quality["warnings"],   # derived from `quality` on every publish, never carried over
    }, indent=1))
    print(f"published {len(df):,} KPI rows, {len(rec)} reconciliation months to {PUBLISHED}")


if __name__ == "__main__":
    main()
