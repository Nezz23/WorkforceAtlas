"""How long federal employees stay: a synthetic-cohort life table from length-of-service exit rates.

There is no person identifier, so no real hiring cohort can be followed. Instead, for each period the annual
separation rate in each length-of-service band (separations / average headcount in that band) is chained into
the share of a hypothetical group of new employees still in federal service after 1 to 10 years, if they met that
period's rates at every stage. This is the demographer's period life table. The rate is exits per person-year, a
hazard, so a year survives with probability exp(-rate); 1 - rate would overstate exits when rates are high.

Bands are <1, 1-2, 3-4 and 5-9 years, so the rate is held constant within each band. Transfers between agencies
are excluded: leaving means leaving federal service. Length of service includes prior federal and creditable
military service, so "new" means new to federal service. 95% intervals come from 2,000 parametric bootstrap
draws of the separation counts (Poisson), with exposure held fixed.
"""
import numpy as np
import pandas as pd

BANDS = [("<1", 1), ("1-2", 2), ("3-4", 2), ("5-9", 5)]   # band, years it spans
PERIODS = {"FY2015–2019": range(2015, 2020), "FY2020–2021": range(2020, 2022), "FY2022–2024": range(2022, 2025),
           "FY2025": range(2025, 2026), "FY2026": range(2026, 2027)}
DRAWS = 2000


def curve(rates: np.ndarray) -> np.ndarray:
    """Survival at years 0..10 from annual rates per band (rates: draws x bands)."""
    per_year = np.concatenate([np.repeat(rates[:, [i]], years, axis=1) for i, (_, years) in enumerate(BANDS)], axis=1)
    return np.concatenate([np.ones((rates.shape[0], 1)), np.cumprod(np.exp(-per_year), axis=1)], axis=1)


def table(seg: pd.DataFrame, scope: str, rng: np.random.Generator) -> dict | None:
    s = seg[(seg.scope == scope) & (seg.dimension == "los_band")]
    out = {}
    for name, years in PERIODS.items():
        p = s[s.fy.isin(years)].groupby("level")[["separations", "avg_headcount"]].sum()
        if not all(b in p.index for b, _ in BANDS) or (p.loc[[b for b, _ in BANDS], "avg_headcount"] < 200).any():
            continue
        sep = p.loc[[b for b, _ in BANDS], "separations"].to_numpy(float)
        exp = p.loc[[b for b, _ in BANDS], "avg_headcount"].to_numpy(float)
        point = curve((sep / exp)[None, :])[0]
        boot = curve(rng.poisson(sep, size=(DRAWS, len(BANDS))) / exp)
        lo, hi = np.quantile(boot, [0.025, 0.975], axis=0)
        out[name] = {"rates": {b: round(float(r) * 100, 2) for (b, _), r in zip(BANDS, sep / exp)},
                     "survival": [{"year": y, "v": round(float(point[y]) * 100, 2), "lo": round(float(lo[y]) * 100, 2),
                                   "hi": round(float(hi[y]) * 100, 2)} for y in range(11)]}
    return out or None


def run(seg: pd.DataFrame, scopes: list[str]) -> dict:
    rng = np.random.default_rng(7)
    tables = {s: t for s in scopes if (t := table(seg, s, rng))}
    return {"periods": list(PERIODS), "bands": [b for b, _ in BANDS], "draws": DRAWS, "tables": tables}
