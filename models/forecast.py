"""Department headcount forecasts, chosen and judged by a rolling-origin backtest with a time-ordered split.

Candidates, all fitted only on data up to the forecast origin:
  naive        H(T+h) = H(T)
  drift        H(T) + h x average monthly change over the last 12 months
  ets          damped-trend, additive-seasonal exponential smoothing on log headcount
  stock_flow   forecast hires and non-DRP exits separately (seasonal ETS), add the recent reconciliation gap,
               and roll the stock forward: H(t+1) = H(t) + A(t+1) - S(t+1) + gap

Evaluation is split by target month, so no number is both used to choose and reported as a result:
  selection    targets up to 2022-12: the method with the lowest 12-month WAPE is chosen, separately for the
               government-wide series and for departments
  test         targets 2023-01 to 2024-12: reported once, never used to choose
  shock        targets from 2025-01: reported apart; no model fitted on history could foresee the deferred
               resignation program
A department enters the backtest at an origin only if it had at least 5,000 employees at that origin, so the
scope list never depends on which departments are large today.

Intervals are empirical: quantiles of the chosen method's past log errors at each horizon. An origin may only use
errors whose target month had already happened by then. Two ways to pick the quantiles are compared:
  fixed     the 10% and 90% quantiles (2.5% and 97.5% for the 95% range), always
  adaptive  adaptive conformal inference (Gibbs and Candes, 2021): the miss rate aimed for moves after each outcome,
            a_new = a + GAMMA x (target miss rate - share missed), so a run of misses widens the next ranges and a
            run of hits narrows them. It is designed so the long-run miss rate tracks the target as the errors change;
            with about 44 quarterly origins, delayed feedback and the bounds below that is an aim, not a guarantee here.
            GAMMA and the bounds were set before any test.
Each is scored on the 80% interval score (width, plus 10x any distance by which the outcome fell outside), which
rewards ranges that hold the outcome without being needlessly wide. The adaptive method is used unless it scores more
than 2% worse than the fixed one on targets up to 2022-12; test and shock windows are reported, never used to choose.
The published ranges use every error to the latest month, including 2025-2026, and the latest adaptive miss rate.

Months OPM reports as incomplete (pipeline/notices.py) are never a forecast origin and never a flow input: a
department's missing flows are replaced by the same calendar month's median over the three prior years, and the
government-wide series is corrected by swapping that department's reported count for its estimate.

The simulator needs monthly flows that add up to the plotted forecast. Each month's forecast change is split into the
flow models' hires and exits (left as forecast, so a lever scales a realistic number) and an explicit remainder,
"other change": transfers, reorganisations and the reconciliation gap, plus any disagreement between the stock and
flow forecasts. hires - exits + other equals the forecast's change, so the default scenario is the forecast by
construction, and the size of the remainder is published rather than hidden in rescaled flows.
"""
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

H_MAX = 24
METHODS = ("naive", "drift", "ets", "stock_flow")
SELECT_END, TEST_END = 202212, 202412
TRAIN_YEARS = 8              # fit window for the smoothing models
MIN_SIZE = 5000              # departments smaller than this at an origin are not forecast from it
MIN_ERRORS = 20              # fewer past errors than this give no interval
GAMMA = 0.05                 # adaptive step per quarterly origin; set a priori, not tuned
A_RANGE = (0.25, 3.0)        # the adaptive miss rate stays within these multiples of the target (80%: 5%-60%; 95%:
                             # 1.25%-15%), so a range is never empty or infinite and the 80% range stays inside the 95%


def add_months(m: int, k: int) -> int:
    y, mm = divmod(m, 100)
    t = y * 12 + mm - 1 + k
    return (t // 12) * 100 + t % 12 + 1


def window(target) -> np.ndarray:
    t = np.asarray(target)
    return np.where(t <= SELECT_END, "selection", np.where(t <= TEST_END, "test", "shock"))


def seasonal_estimate(x: pd.Series, month: int) -> float:
    prior = [p for p in (month - 100 * y for y in (1, 2, 3)) if p in x.index]
    return float(np.median(x.loc[prior])) if prior else float("nan")


def series(kpi: pd.DataFrame, scope: str, gaps: set = frozenset()) -> pd.DataFrame:
    """Monthly stock and flows for one scope. Government-wide flows exclude transfers; department flows include them.
    Flows in months OPM reports as incomplete are replaced by a seasonal estimate (see module notes)."""
    k = kpi[kpi.scope == scope].sort_values("month").set_index("month")
    cols = {"A": "acc_new_hire" if scope == "ALL" else "accessions", "S": None}
    hires = k[cols["A"]].astype(float).copy()
    exits = (k["separations"] - k["sep_drp"]).astype(float)       # DRP is a one-off program: forecast without it
    gap = k["headcount"].diff() - (hires - k["separations"])
    for (s, m, stream) in gaps:
        if m not in k.index or s == "ALL":
            continue
        if scope == s or scope == "ALL":
            d = kpi[kpi.scope == s].set_index("month")
            col = d["acc_new_hire" if scope == "ALL" else "accessions"] if stream == "accessions" else d["separations"] - d["sep_drp"]
            est = seasonal_estimate(col.astype(float), m)
            target = hires if stream == "accessions" else exits
            target.at[m] = (est if scope == s else target.at[m] - col.at[m] + est)
    out = pd.DataFrame({"H": k["headcount"].astype(float), "A": hires, "S": exits, "gap": gap})
    out["H_ok"] = [(scope, m, "headcount") not in gaps for m in out.index]
    return out


def _ets(y: np.ndarray, trend: bool, steps: int) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ExponentialSmoothing(y, trend="add" if trend else None, damped_trend=trend, seasonal="add",
                                   seasonal_periods=12, initialization_method="estimated").fit(optimized=True)
    return fit.forecast(steps)


def flow_forecast(hist: pd.DataFrame, steps: int) -> tuple[np.ndarray, np.ndarray, float]:
    w = hist.iloc[-TRAIN_YEARS * 12:]
    a = np.expm1(_ets(np.log1p(w["A"].to_numpy()), False, steps)).clip(min=0)
    x = np.expm1(_ets(np.log1p(w["S"].to_numpy()), False, steps)).clip(min=0)
    g = float(hist["gap"].drop([202509, 202510], errors="ignore").iloc[-24:].mean())
    return a, x, g


def seasonal_flows(hist: pd.DataFrame, steps: int) -> tuple[np.ndarray, np.ndarray]:
    """Hires and exits for each future month: the median of the same calendar month over the last three years.
    Used for department simulators, where one spike at the origin (a reorganisation moving staff in) would otherwise
    be extrapolated by a smoothing model."""
    origin = int(hist.index.max())
    def med(col: str, month: int) -> float:
        past = [m for m in hist.index if m % 100 == month % 100][-3:]
        return float(np.median(hist.loc[past, col])) if past else 0.0
    months = [add_months(origin, h) for h in range(1, steps + 1)]
    a = np.array([med("A", m) for m in months])
    x = np.array([med("S", m) for m in months])
    return a, x


def forecast(s: pd.DataFrame, origin: int, method: str, steps: int = H_MAX) -> np.ndarray:
    """Headcount forecast for origin+1 .. origin+steps, using only rows up to `origin`. Never below one person."""
    return np.maximum(_forecast(s, origin, method, steps), 1.0)


def _forecast(s: pd.DataFrame, origin: int, method: str, steps: int) -> np.ndarray:
    hist = s.loc[:origin]
    h0 = float(hist["H"].iloc[-1])
    horizon = np.arange(1, steps + 1)
    if method == "naive":
        return np.full(steps, h0)
    if method == "drift":
        return h0 + horizon * (h0 - float(hist["H"].iloc[-13])) / 12
    if method == "ets":
        return np.exp(_ets(np.log(hist["H"].iloc[-TRAIN_YEARS * 12:].to_numpy()), True, steps))
    if method == "stock_flow":
        a, x, g = flow_forecast(hist, steps)
        return h0 + np.cumsum(a - x + g)
    raise ValueError(method)


def decompose(path: np.ndarray, h0: float, a: np.ndarray, x: np.ndarray) -> np.ndarray:
    """Other change per month: the part of the forecast's monthly change that forecast hires and exits do not explain."""
    return np.diff(np.concatenate([[h0], path])) - (a - x)


def level(scope: str) -> str:
    return "government-wide" if scope == "ALL" else "departments"


def backtest(kpi: pd.DataFrame, scopes: list[str], origins: list[int], gaps: set) -> pd.DataFrame:
    rows = []
    for scope in scopes:
        s = series(kpi, scope, gaps)
        last = int(s.index.max())
        for origin in origins:
            if origin not in s.index or add_months(origin, 1) > last or not s.at[origin, "H_ok"]:
                continue
            if scope != "ALL" and s.at[origin, "H"] < MIN_SIZE:
                continue
            for method in METHODS:
                fc = forecast(s, origin, method)
                for h in range(1, H_MAX + 1):
                    target = add_months(origin, h)
                    if target > last:
                        break
                    if not s.at[target, "H_ok"]:
                        continue
                    rows.append({"scope": scope, "origin": origin, "method": method, "h": h, "target": target,
                                 "actual": float(s.at[target, "H"]), "forecast": float(fc[h - 1])})
    bt = pd.DataFrame(rows)
    bt["abs_err"] = (bt["forecast"] - bt["actual"]).abs()
    bt["log_err"] = np.log(bt["actual"] / bt["forecast"])
    bt["window"] = window(bt["target"])
    bt["level"] = bt["scope"].map(level)
    return bt


def wape(df: pd.DataFrame) -> float | None:
    return round(float(100 * df["abs_err"].sum() / df["actual"].sum()), 3) if len(df) else None


def sequential_bounds(errs: pd.DataFrame, alpha: float, adaptive: bool) -> tuple[pd.DataFrame, dict]:
    """Each row's interval from the same level and horizon's errors whose target <= its origin, and the interval each
    (level, horizon) would publish today from every error. Adaptive: the miss rate used moves after each origin by
    the share of earlier intervals, now resolved, that missed."""
    rows, latest = [], {}
    for (lv, h), g in errs.groupby(["level", "h"]):
        g = g.sort_values("origin")
        origin_, target, err = g["origin"].to_numpy(), g["target"].to_numpy(), g["log_err"].to_numpy()
        lo, hi = np.full(len(g), np.nan), np.full(len(g), np.nan)
        a, scored = alpha, np.zeros(len(g), bool)

        def update(known):
            nonlocal a, scored
            new = known & ~scored & ~np.isnan(lo)
            if adaptive and new.any():
                missed = float(np.mean((err[new] < lo[new]) | (err[new] > hi[new])))
                a = float(np.clip(a + GAMMA * (alpha - missed), alpha * A_RANGE[0], min(alpha * A_RANGE[1], 0.6)))
            scored |= new

        for o in np.unique(origin_):
            known = target <= o
            update(known)
            if known.sum() >= MIN_ERRORS:
                at = origin_ == o
                lo[at], hi[at] = np.quantile(err[known], [a / 2, 1 - a / 2])
        update(np.ones(len(g), bool))
        latest[(lv, h)] = tuple(np.quantile(err, [a / 2, 1 - a / 2]))
        rows.append(pd.DataFrame({"lo": lo, "hi": hi}, index=g.index))
    return errs.join(pd.concat(rows)), latest


def interval_scores(b: pd.DataFrame, alpha: float = 0.2) -> dict:
    """Coverage, mean width and mean interval score (log points x 100, about percent) by level and window."""
    b = b[b.lo.notna()]
    y = b.log_err
    covered = (y >= b.lo) & (y <= b.hi)
    score = 100 * ((b.hi - b.lo) + 2 / alpha * ((b.lo - y).clip(lower=0) + (y - b.hi).clip(lower=0)))
    t = pd.DataFrame({"level": b.level, "window": b.window, "covered": covered, "width": 100 * (b.hi - b.lo), "score": score})
    return {lv: {w: {"n": int(len(g)), "coverage": round(float(100 * g.covered.mean()), 1),
                     "width": round(float(g.width.mean()), 2), "score": round(float(g.score.mean()), 2)}
                 for w, g in d.groupby("window")} for lv, d in t.groupby("level")}


def run(kpi: pd.DataFrame, scopes: list[str], gaps: set = frozenset()) -> dict:
    origins = [m for m in sorted(kpi.month.unique()) if m >= 201512 and m % 100 in (3, 6, 9, 12)]
    candidates = ["ALL"] + sorted(set(kpi[(kpi.scope != "ALL") & (kpi.headcount >= MIN_SIZE)].scope) - {"UNKNOWN"})
    bt = backtest(kpi, candidates, origins, gaps)

    table = {lv: {w: {m: {str(h): wape(bt[(bt.level == lv) & (bt.window == w) & (bt.method == m) & (bt.h == h)])
                         for h in (1, 3, 6, 12, 24)} for m in METHODS} for w in ("selection", "test", "shock")}
             for lv in ("government-wide", "departments")}
    chosen = {lv: min(METHODS, key=lambda m: table[lv]["selection"][m]["12"]) for lv in table}
    errs = bt[bt.method == bt.level.map(chosen)]
    by_year = (errs[errs.h == 12].assign(year=errs.target // 100).groupby(["level", "year"])
               .apply(wape, include_groups=False).rename("wape").reset_index().to_dict("records"))

    runs = {kind: {a: sequential_bounds(errs, a, kind == "adaptive") for a in (0.2, 0.05)} for kind in ("fixed", "adaptive")}
    iv = {kind: interval_scores(r[0.2][0]) for kind, r in runs.items()}
    iv_kind = {lv: "adaptive" if iv["adaptive"][lv]["selection"]["score"] <= 1.02 * iv["fixed"][lv]["selection"]["score"]
               else "fixed" for lv in table}
    coverage = {lv: {w: iv[iv_kind[lv]][lv][w]["coverage"] for w in ("test", "shock")} for lv in table}

    def qtab(lv):
        """Today's per-horizon quantiles (95% low, 80% low, 80% high, 95% high), made monotone: a range may not narrow
        as the horizon grows (each lower bound is the running minimum, each upper the running maximum), and the 95%
        range always contains the 80% one. The published ranges are the drawn ranges."""
        r = runs[iv_kind[lv]]
        raw = np.array([[r[0.05][1][(lv, h)][0], r[0.2][1][(lv, h)][0], r[0.2][1][(lv, h)][1], r[0.05][1][(lv, h)][1]]
                        for h in range(1, H_MAX + 1)])
        raw[:, 0], raw[:, 3] = np.minimum(raw[:, 0], raw[:, 1]), np.maximum(raw[:, 3], raw[:, 2])
        lo, hi = np.minimum.accumulate(raw[:, :2], axis=0), np.maximum.accumulate(raw[:, 2:], axis=0)
        return {h: [*lo[h - 1], *hi[h - 1]] for h in range(1, H_MAX + 1)}
    q = {lv: qtab(lv) for lv in table}

    out = {}
    for scope in scopes:
        s = series(kpi, scope, gaps)
        origin = int(s.index[s.H_ok].max())
        method = chosen[level(scope)]
        fc = forecast(s, origin, method)
        qs = q[level(scope)]
        points = [{"t": add_months(origin, h), "v": round(float(fc[h - 1])),
                   **{k: round(float(fc[h - 1] * np.exp(qs[h][i]))) for i, k in enumerate(("lo95", "lo80", "hi80", "hi95"))}}
                  for h in range(1, H_MAX + 1)]
        h0 = float(s.at[origin, "H"])
        a, x = flow_forecast(s.loc[:origin], H_MAX)[:2] if method == "stock_flow" else seasonal_flows(s.loc[:origin], H_MAX)
        other = decompose(fc, h0, a, x)
        out[scope] = {"origin": origin, "method": method, "headcount": int(h0), "forecast": points,
                      "flows": {"hires": [round(float(v), 1) for v in a], "exits": [round(float(v), 1) for v in x],
                                "other": [round(float(v), 1) for v in other],
                                "hires_12": round(float(a[:12].sum())), "exits_12": round(float(x[:12].sum())),
                                "other_12": round(float(other[:12].sum())), "change_12": round(float(fc[11] - h0))}}

    trace = errs[(errs.scope == "ALL") & (errs.origin % 100 == 9)]
    return {
        "chosen": chosen, "methods": list(METHODS), "windows": {"selection": [None, SELECT_END], "test": [202301, TEST_END],
                                                                  "shock": [202501, None]},
        "wape": table, "wape_by_year_12m": by_year, "interval_coverage_80": coverage,
        "intervals": {"chosen": iv_kind, "gamma": GAMMA, "scores_80": iv},
        "n_origins": len(origins), "origins": [origins[0], origins[-1]], "min_size": MIN_SIZE, "scopes": scopes,
        "forecasts": out,
        "trace": trace[["origin", "h", "target", "actual", "forecast"]].to_dict("records"),
    }
