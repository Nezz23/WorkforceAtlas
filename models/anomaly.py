"""Unusual months: each count against the same calendar month in the previous five years.

For a series (scope x flow type), month t is scored as
    z = (log(1 + x_t) - log(1 + E_t)) / s
where E_t is the median of the same calendar month over up to five prior years (at least three) and s is 1.4826 x
the median absolute deviation of the series' previous 60 log ratios (a robust standard deviation, at least 24 needed).
The flag threshold is set on calendar 2017-2019, a period without a known workforce program, so that 1% of scored
months there are flagged; the flag rate on 2022-2024, which the threshold never saw, is reported as the out-of-sample
false-alarm rate. A run of three months beyond half the threshold in one direction marks a sustained shift.

Months OPM reports as incomplete (pipeline/notices.py) are scored but never published as signals: they are listed
apart as reporting gaps, because a missing submission looks exactly like a collapse in the count.
"""
import numpy as np
import pandas as pd

FLOWS = {   # column in kpi_monthly -> label
    "sep_quit": "Quits", "sep_retirement": "Retirements", "sep_rif": "Reductions in force",
    "sep_termination": "Terminations and expired appointments", "sep_transfer": "Transfers out",
    "acc_new_hire": "New hires",
}
MIN_EXPECTED = 10        # smaller series are too noisy to score
CALIBRATION = (201701, 201912)
HOLDOUT = (202201, 202412)
MIN_YEARS, MAX_YEARS, MIN_HISTORY = 3, 5, 24
FALSE_ALARM = 0.01


def scored(kpi: pd.DataFrame, scopes: list[str]) -> pd.DataFrame:
    out = []
    for scope in scopes:
        k = kpi[kpi.scope == scope].sort_values("month").set_index("month")
        for col, label in FLOWS.items():
            if scope == "ALL" and col == "sep_transfer":
                continue                       # transfers are excluded government-wide
            x = k[col].astype(float)
            months = list(x.index)
            rows = []
            for i, t in enumerate(months):
                prior = [p for p in (add_years(t, -y) for y in range(1, MAX_YEARS + 1)) if p in x.index]
                if len(prior) < MIN_YEARS:
                    continue
                e = float(np.median(x.loc[prior]))
                rows.append((t, float(x.at[t]), e))
            if not rows:
                continue
            df = pd.DataFrame(rows, columns=["month", "actual", "expected"])
            df["log_ratio"] = np.log1p(df["actual"]) - np.log1p(df["expected"])
            # Scale from the series' own history up to (not including) the scored month.
            scale = [1.4826 * np.median(np.abs(df["log_ratio"].iloc[max(0, i - 60):i] - np.median(df["log_ratio"].iloc[max(0, i - 60):i])))
                     if i >= MIN_HISTORY else np.nan for i in range(len(df))]
            df["scale"] = np.maximum(scale, 0.05)
            df["z"] = df["log_ratio"] / df["scale"]
            df["scope"], df["flow"], df["label"] = scope, col, label
            out.append(df[df["expected"] >= MIN_EXPECTED])
    return pd.concat(out, ignore_index=True).dropna(subset=["z"])


def add_years(m: int, k: int) -> int:
    return m + 100 * k


def stream(flow: str) -> str:
    return "accessions" if flow.startswith("acc") else "separations"


def run(kpi: pd.DataFrame, scopes: list[str], names: dict[str, str], gaps: set[tuple[str, int, str]]) -> dict:
    df = scored(kpi, scopes)
    df["data_issue"] = [(s, m, stream(f)) in gaps for s, m, f in zip(df.scope, df.month, df.flow)]
    window = lambda w: df[(df.month >= w[0]) & (df.month <= w[1]) & ~df.data_issue]
    calm, holdout = window(CALIBRATION), window(HOLDOUT)
    if calm.month.nunique() < 36:
        raise ValueError(f"calibration window {CALIBRATION} has {calm.month.nunique()} scored months, need 36")
    tau = float(np.quantile(calm["z"].abs(), 1 - FALSE_ALARM))
    df["flag"] = df["z"].abs() >= tau
    df["severity"] = np.where(df["z"].abs() >= 1.5 * tau, "high", np.where(df["flag"], "moderate", ""))
    # Sustained shift: this month and the two before beyond tau/2, all in the same direction.
    df = df.sort_values(["scope", "flow", "month"])
    sign = np.sign(df["z"]) * (df["z"].abs() >= tau / 2)
    df["sustained"] = sign.groupby([df.scope, df.flow]).transform(lambda s: (s.rolling(3).sum().abs() == 3)).astype(bool)

    latest = int(df.month.max())
    def alert(r):
        return {"scope": r.scope, "name": names.get(r.scope, r.scope), "flow": r.flow, "label": r.label,
                "month": int(r.month), "actual": int(r.actual), "expected": round(r.expected, 1),
                "ratio": round((r.actual + 1) / (r.expected + 1), 2), "z": round(r.z, 2), "severity": r.severity,
                "sustained": bool(r.sustained)}
    hits = df[(df.flag | df.sustained) & (df.month > latest - 200)].sort_values(["month", "z"], ascending=[False, False])
    recent, gap = hits[~hits.data_issue], hits[hits.data_issue]
    flags_all = df[df.flag & ~df.data_issue].groupby("month").size().rename("flags").reset_index()
    return {
        "threshold": round(tau, 2), "calibration": list(CALIBRATION), "holdout": list(HOLDOUT),
        "false_alarm_target": FALSE_ALARM,
        "calm_flag_rate": round(float((calm["z"].abs() >= tau).mean() * 100), 2),
        "holdout_flag_rate": round(float((holdout["z"].abs() >= tau).mean() * 100), 2),
        "n_calibration": int(len(calm)), "n_holdout": int(len(holdout)),
        "latest": latest, "n_series": int(df.groupby(["scope", "flow"]).ngroups),
        "alerts_latest": [alert(r) for r in recent[recent.month == latest].itertuples()],
        "alerts_recent": [alert(r) for r in recent.itertuples()][:200],
        "gaps_recent": [alert(r) for r in gap.itertuples()],
        "flags_by_month": flags_all.astype(int).to_dict("records"),
    }
