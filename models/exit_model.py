"""Group-level voluntary exit rates: what structure explains them, and how far 2025-2026 departed from it.

Unit: cells of department x grade band x length-of-service band x age bracket x supervisory status x fiscal year.
Target: voluntary separations (quits and voluntary or early-out retirements, transfers excluded), with the cell's
average headcount as exposure. No individual is scored; no person-level data exists.

Models, compared on mean Poisson deviance:
  baseline  each department's pooled training rate
  glm       Poisson regression with an exposure offset; main effects only, so every coefficient is a rate ratio
  gbm       histogram gradient boosting with a Poisson loss, the same features, interactions allowed
  gbm_lm    gbm with a labour-market level: each year's predictions are scaled by exp(b0 + b1 x (q - mean q)), where
            q is that fiscal year's private-sector quit rate (BLS JOLTS, pipeline/labour.py). b0 and b1 come from a
            Poisson GLM on the training years with the gbm's in-sample predictions as offset, so the one extra
            coefficient learns only how the year's level moves with outside job options. The gbm's yearly misses
            followed the quit rate (FY2020 low, FY2022 high, FY2024 low); the structure has no other year signal.
Rolling origin by fiscal year: for each year FY2019-FY2024 every model is fitted on FY2015 up to the year before and
scored on that year. FY2019-2022 choose the model (the GBM must beat the GLM by more than 2%); FY2023-2024 are the
test, reported per year with the bias of the predicted total, and never used to choose. gbm_lm replaces gbm only
if it lowers the FY2019-2022 deviance by more than 2% too. The quit rate is the same year's, so gbm_lm's
expectation reads "given the structure and that year's labour market", which is what the FY2025-2026 departure
asks; it is not a forecast made before the year began.

FY2025-2026 are out of distribution: the chosen model refitted on FY2015-2024 gives each department's expected
voluntary exits, and actual / expected measures the departure from its own structure. It is reported twice: with
all voluntary exits, and with deferred resignation program (DRP) exits removed. Neither is "the" effect of the
program: DRP takers include people who would have retired or quit anyway, so the first overstates the departure
from normal behaviour and the second understates it.

Intervals on those ratios are on the log scale with two parts: overdispersion (variance = dispersion x mean, the
dispersion estimated by the GLM's Pearson statistic) and model error (how far actual/expected strayed for
departments in the rolling-origin years, including any bias). A Poisson-only interval would be far too narrow.

The explanation shown is the chosen model's own: for each feature level, the exposure-weighted average predicted
rate with every cell set to that level, divided by the same for the reference level (partial dependence). The
GLM's rate ratios are kept as a check. All are associations, not causes; age is a feature because retirement
depends on it.
"""
import duckdb
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import chi2
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_poisson_deviance

FEATURES = ["dept", "grade_band", "los_band", "age_bracket", "supervisor"]
FIRST, SELECT, TEST = 2015, (2019, 2020, 2021, 2022), (2023, 2024)
REFERENCE = {"dept": "VA", "grade_band": "GS 8-12", "los_band": "10-19", "age_bracket": "40-44", "supervisor": "Non-supervisory"}
MODELS = ("baseline", "glm", "gbm", "gbm_lm")
MIN_DEPT = 5000   # departments below this average headcount are pooled as OTHER


def cells(warehouse: str = "data/warehouse", skip: set[tuple[str, int]] = frozenset()) -> pd.DataFrame:
    """Cells by fiscal year. `skip` holds (department, month) pairs OPM reports incomplete: both the headcount and the
    separations of those months are left out for that department, so its rate is measured on the months that are whole."""
    con = duckdb.connect()
    con.execute("create temp table skip (department_code varchar, month int)")
    if skip:
        con.executemany("insert into skip values (?, ?)", sorted(skip))
    return con.execute(f"""
        with hc as (
            select month // 100 + (month % 100 >= 10)::int as fy, department_code, grade_band, los_band, age_bracket,
                   case when supervisor then 'Supervisor or manager' else 'Non-supervisory' end as supervisor,
                   sum(n) / 12.0 as exposure
            from read_parquet('{warehouse}/headcount/*.parquet') h
            where not exists (select 1 from skip k where k.department_code = h.department_code and k.month = h.month)
            group by all
        ),
        sep as (
            select s.month // 100 + (s.month % 100 >= 10)::int as fy, s.department_code, s.grade_band, s.los_band,
                   s.age_bracket, case when s.supervisor then 'Supervisor or manager' else 'Non-supervisory' end as supervisor,
                   sum(s.n) as voluntary, sum(s.n) filter (where s.drp) as drp
            from read_parquet('{warehouse}/separations/*.parquet') s
            join read_csv('ref/separation_categories.csv') r on r.code = s.category
            where r.voluntary
              and not exists (select 1 from skip k where k.department_code = s.department_code and k.month = s.month)
            group by all
        ),
        months as (select month // 100 + (month % 100 >= 10)::int as fy, count(distinct month) as m
                   from read_parquet('{warehouse}/headcount/*.parquet') group by 1)
        select hc.*, coalesce(sep.voluntary, 0) as voluntary, coalesce(sep.drp, 0) as drp
        from hc join months using (fy) left join sep using (fy, department_code, grade_band, los_band, age_bracket, supervisor)
        where months.m = 12 and hc.los_band <> 'Unknown' and hc.age_bracket not in ('Unknown', 'LESS THAN 20', 'UNSPECIFIED')
    """).df()


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    train = range(FIRST, SELECT[0])
    big = df[df.fy.isin(train)].groupby("department_code").exposure.sum() / len(train)
    keep = set(big[big >= MIN_DEPT].index)
    df = df.assign(dept=np.where(df.department_code.isin(keep), df.department_code, "OTHER"))
    df = df.groupby(["fy"] + FEATURES, as_index=False)[["exposure", "voluntary", "drp"]].sum()
    return df[df.exposure > 0.5]


def design(df: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    X = pd.get_dummies(df[FEATURES].astype(str), dtype=float)
    X = X.drop(columns=[f"{k}_{v}" for k, v in REFERENCE.items()], errors="ignore")
    if columns is not None:
        X = X.reindex(columns=columns, fill_value=0.0)
    return sm.add_constant(X, has_constant="add")


def fit_glm(train: pd.DataFrame):
    X = design(train)
    model = sm.GLM(train.voluntary, X, family=sm.families.Poisson(), offset=np.log(train.exposure)).fit(scale="X2")
    return model, list(X.columns)


def fit_gbm(train: pd.DataFrame):
    X = train[FEATURES].astype("category")
    gbm = HistGradientBoostingRegressor(loss="poisson", learning_rate=0.05, max_iter=400, max_leaf_nodes=31,
                                        categorical_features="from_dtype", random_state=7)
    gbm.fit(X, train.voluntary / train.exposure, sample_weight=train.exposure)
    return gbm


def predict_glm(model, columns, df):
    return model.predict(design(df, [c for c in columns if c != "const"]), offset=np.log(df.exposure))


def predict_gbm(gbm, df, categories):
    X = df[FEATURES].astype(str)
    for c in FEATURES:
        X[c] = pd.Categorical(X[c], categories=categories[c])
    return gbm.predict(X) * df.exposure


def deviance(y, mu):
    return float(mean_poisson_deviance(y, np.maximum(mu, 1e-9), sample_weight=None))


def categories(df: pd.DataFrame) -> dict:
    return {c: sorted(df[c].astype(str).unique()) for c in FEATURES}


def fit_level(train: pd.DataFrame, mu_in: np.ndarray, quits: dict[int, float]):
    """(b0, b1, se1, mean q): Poisson GLM of voluntary exits on the centred quit rate, offset by log in-sample mu.
    The quit rate varies only by year, so se1 is clustered by fiscal year: the effective sample is the years, not
    the cells."""
    q = train.fy.map(quits).to_numpy()
    qbar = float(np.average(q, weights=train.exposure))
    m = sm.GLM(train.voluntary.to_numpy(), sm.add_constant(q - qbar), family=sm.families.Poisson(),
               offset=np.log(np.maximum(mu_in, 1e-9))).fit(cov_type="cluster", cov_kwds={"groups": train.fy.to_numpy()})
    return float(m.params[0]), float(m.params[1]), float(m.bse[1]), qbar


def fit_all(train: pd.DataFrame, quits: dict[int, float]) -> dict:
    """Every candidate fitted on one training frame; each returns expected counts for a frame."""
    dept_rate = train.groupby("dept").voluntary.sum() / train.groupby("dept").exposure.sum()
    overall = train.voluntary.sum() / train.exposure.sum()
    glm, cols = fit_glm(train)
    gbm, cats = fit_gbm(train.assign(**{c: train[c].astype(str) for c in FEATURES})), categories(train)
    b0, b1, se1, qbar = fit_level(train, predict_gbm(gbm, train, cats).to_numpy(), quits)
    return {"baseline": lambda d: d.dept.map(dept_rate).fillna(overall).to_numpy() * d.exposure.to_numpy(),
            "glm": lambda d: np.asarray(predict_glm(glm, cols, d)),
            "gbm": lambda d: np.asarray(predict_gbm(gbm, d, cats)),
            "gbm_lm": lambda d: np.asarray(predict_gbm(gbm, d, cats)) * np.exp(b0 + b1 * (d.fy.map(quits).to_numpy() - qbar)),
            "_glm": glm, "_gbm": gbm, "_cats": cats, "_level": {"b0": b0, "b1": b1, "se": se1, "mean_rate": qbar}}


def partial_dependence(predict, frame: pd.DataFrame) -> list[dict]:
    out = []
    for f in FEATURES:
        def avg_rate(level):
            mu = predict(frame.assign(**{f: level}))
            return mu.sum() / frame.exposure.sum()
        ref = avg_rate(REFERENCE[f])
        for level in sorted(frame[f].astype(str).unique()):
            if level != REFERENCE[f]:
                out.append({"feature": f, "level": level, "rate_ratio": round(float(avg_rate(level) / ref), 3)})
    return out


def log_interval(ratio: float, count: float, phi: float, s2: float, level_var: float = 0.0) -> tuple[float, float]:
    """95% interval on the log scale: overdispersion, model error, and the uncertainty of the year's level term."""
    se = np.sqrt(phi / max(count, 1.0) + s2 + level_var)
    return float(ratio * np.exp(-1.96 * se)), float(ratio * np.exp(1.96 * se))


def run(gaps: set[tuple[str, int, str]] = frozenset(), quits: dict[int, float] | None = None) -> dict:
    """`quits`: private-sector quit rate by fiscal year (pipeline.labour.by_fiscal_year)."""
    missing = [y for y in range(FIRST, TEST[-1] + 1) if y not in (quits or {})]
    if missing:
        raise ValueError(f"no full-year private-sector quit rate for FY{missing}: run python -m pipeline.labour")
    skip = {(s, m) for s, m, stream in gaps if s != "ALL" and stream in ("separations", "headcount")}
    df = prepare(cells(skip=skip))
    years = SELECT + TEST

    # Rolling origin: fit on FY2015..y-1, score year y.
    per_year, dept_pred, fits = [], [], {}
    for y in years:
        train, frame = df[df.fy.between(FIRST, y - 1)], df[df.fy == y]
        fits[y] = m = fit_all(train, quits)
        for name in MODELS:
            mu = m[name](frame)
            per_year.append({"fy": y, "model": name, "deviance": round(deviance(frame.voluntary, mu), 4),
                             "predicted": round(float(mu.sum())), "actual": int(frame.voluntary.sum()),
                             "bias_pct": round(float(100 * (mu.sum() / frame.voluntary.sum() - 1)), 1)})
            g = frame.assign(mu=mu).groupby("dept").agg(actual=("voluntary", "sum"), mu=("mu", "sum"))
            dept_pred += [{"fy": y, "model": name, "dept": d, "actual": float(r.actual), "mu": float(r.mu)} for d, r in g.iterrows()]
    py = pd.DataFrame(per_year)
    mean_dev = lambda yrs: py[py.fy.isin(yrs)].groupby("model").deviance.mean()
    sel = mean_dev(SELECT)
    chosen = "gbm" if sel["gbm"] < 0.98 * sel["glm"] else "glm"
    if chosen == "gbm" and sel["gbm_lm"] < 0.98 * sel["gbm"]:
        chosen = "gbm_lm"
    test = mean_dev(TEST)

    # Calibration on the last test year, from the fit that never saw it.
    last = df[df.fy == TEST[-1]]
    mu = fits[TEST[-1]][chosen](last)
    t = last.assign(mu=mu, rate=mu / last.exposure)
    t["decile"] = pd.qcut(t.rate.rank(method="first"), 10, labels=False)
    calib = t.groupby("decile").agg(predicted=("mu", "sum"), actual=("voluntary", "sum"), exposure=("exposure", "sum"))
    calib = [{"decile": int(i) + 1, "predicted_rate": round(float(100 * r.predicted / r.exposure), 2),
              "actual_rate": round(float(100 * r.actual / r.exposure), 2)} for i, r in calib.iterrows()]

    # Refit on every normal year (FY2015-2024): expectations for FY2025-2026, dispersion and the explanation.
    full = df[df.fy.between(FIRST, TEST[-1])]
    final = fit_all(full, quits)
    expect, phi = final[chosen], float(final["_glm"].scale)

    # Model error: departments' log(actual / expected) over the rolling years, beyond what overdispersion explains.
    dp = pd.DataFrame(dept_pred)
    dp = dp[(dp.model == chosen) & (dp.actual > 0)]
    s2 = max(float(np.mean(np.log(dp.actual / dp.mu) ** 2) - np.mean(phi / dp.actual)), 0.0)

    Xt = last[FEATURES].astype(str)
    cats = fits[TEST[-1]]["_cats"]
    for c in FEATURES:
        Xt[c] = pd.Categorical(Xt[c], categories=cats[c])
    imp = permutation_importance(fits[TEST[-1]]["_gbm"], Xt, last.voluntary / last.exposure, sample_weight=last.exposure,
                                 scoring="neg_mean_poisson_deviance", n_repeats=5, random_state=7)
    importance = sorted([{"feature": f, "increase": round(float(m), 4), "sd": round(float(sd), 4)}
                         for f, m, sd in zip(FEATURES, imp.importances_mean, imp.importances_std)],
                        key=lambda r: -r["increase"])
    ci = final["_glm"].conf_int()
    glm_ratios = []
    for c in ci.index:
        if c == "const":
            continue
        feature, lvl = c.split("_", 1) if not c.startswith(("grade_band", "los_band", "age_bracket")) else \
            ("_".join(c.split("_")[:2]), c.split("_", 2)[2])
        glm_ratios.append({"feature": feature, "level": lvl, "rate_ratio": round(float(np.exp(final["_glm"].params[c])), 3),
                           "lo": round(float(np.exp(ci.loc[c, 0])), 3), "hi": round(float(np.exp(ci.loc[c, 1])), 3)})
    explain = partial_dependence(expect, full[full.fy == TEST[-1]])

    excess = []
    for fy in (2025, 2026):
        d = df[df.fy == fy]
        if d.empty or fy not in quits:
            continue
        d = d.assign(expected=expect(d), expected_no_level=final["gbm"](d))
        g = d.groupby("dept").agg(actual=("voluntary", "sum"), drp=("drp", "sum"), expected=("expected", "sum"),
                                  expected_no_level=("expected_no_level", "sum"), exposure=("exposure", "sum"))
        lv = final["_level"]
        level_var = (lv["se"] * (quits[fy] - lv["mean_rate"])) ** 2 if chosen == "gbm_lm" else 0.0
        g.loc["ALL"] = g.sum()
        for dept, r in g.iterrows():
            ratio, other = r.actual / r.expected, (r.actual - r.drp) / r.expected
            lo, hi = log_interval(ratio, r.actual, phi, s2, level_var)
            lo_n, hi_n = log_interval(other, r.actual - r.drp, phi, s2, level_var)
            excess.append({"fy": fy, "dept": dept, "actual": int(r.actual), "drp": int(r.drp), "expected": round(float(r.expected)),
                           "ratio": round(float(ratio), 2), "ratio_lo": round(lo, 2), "ratio_hi": round(hi, 2),
                           "ratio_excl_drp": round(float(other), 2), "ratio_excl_drp_lo": round(lo_n, 2),
                           "ratio_excl_drp_hi": round(hi_n, 2), "exposure": round(float(r.exposure)),
                           # sensitivity: the same ratios from boosting without the quit-rate level
                           "ratio_no_level": round(float(r.actual / r.expected_no_level), 2),
                           "ratio_excl_drp_no_level": round(float((r.actual - r.drp) / r.expected_no_level), 2)})

    return {
        "chosen": chosen, "select_years": list(SELECT), "test_years": list(TEST),
        "deviance": {"selection_mean": {k: round(v, 4) for k, v in sel.items()}, "test_mean": {k: round(v, 4) for k, v in test.items()}},
        "by_year": per_year,
        "gain_vs_baseline_test_pct": round(100 * (1 - test[chosen] / test["baseline"]), 1),
        "n_cells_train": int(len(full)), "dispersion": round(phi, 2), "model_error_sd_log": round(float(np.sqrt(s2)), 3),
        "reference": REFERENCE, "explanation": explain, "rate_ratios_glm": glm_ratios, "importance": importance,
        "calibration_test": calib, "excess": excess, "departments": sorted(df.dept.unique()),
        "labour_market": {"series": "JTS100000000000000QUR", "source": "https://data.bls.gov/timeseries/JTS100000000000000QUR",
                          "quit_rate_by_fy": {str(y): round(v, 3) for y, v in sorted(quits.items()) if y >= FIRST},
                          **{k: round(v, 4) for k, v in final["_level"].items()}},
    }
