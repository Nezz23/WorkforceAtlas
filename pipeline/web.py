"""data/published -> web/data: small JSON files the static site reads at build time, one per scope where it helps.

    python -m pipeline.web
"""
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PUBLISHED, OUT = ROOT / "data" / "published", ROOT / "web" / "data"


def records(df: pd.DataFrame) -> list[dict]:
    df = df.replace([np.inf, -np.inf], np.nan).astype(object).where(df.notna(), None)
    return [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()} for r in df.to_dict("records")]


def scalar(o):
    """json `default`: numpy scalars become Python numbers; anything else is a bug, not something to stringify."""
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    if isinstance(o, np.bool_):
        return bool(o)
    raise TypeError(f"cannot serialize {type(o).__name__}: {o!r}")


def dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), default=scalar, allow_nan=False))


def main() -> None:
    shutil.rmtree(OUT, ignore_errors=True)
    kpi = pd.read_parquet(PUBLISHED / "kpi_monthly.parquet")
    pay = pd.read_parquet(PUBLISHED / "pay_gs.parquet")
    seg = pd.read_parquet(PUBLISHED / "segments_fy.parquet")
    exposure = pd.read_parquet(PUBLISHED / "retirement_exposure.parquet")
    names = pd.read_parquet(PUBLISHED / "dim_names.parquet")

    latest = int(kpi.month.max())
    dept = names[names.dim == "department"].set_index("code")["name"]
    now = kpi[(kpi.month == latest) & (kpi.scope != "ALL")].set_index("scope")
    year_ago = kpi[(kpi.month == latest - 100) & (kpi.scope != "ALL")].set_index("scope")["headcount"]
    scopes = [{"code": c, "name": dept.get(c, c), "headcount": int(now.at[c, "headcount"]),
               "headcount_year_ago": int(year_ago[c]) if c in year_ago and pd.notna(year_ago[c]) else None}
              for c in now.index]
    dump(OUT / "scopes.json", sorted(scopes, key=lambda d: -d["headcount"]))

    for scope, g in kpi.groupby("scope"):
        dump(OUT / "kpi" / f"{scope}.json", records(g.drop(columns="scope")))
        p = pay[(pay.department_code == scope) & ((pay.grade == "ALL") | (pay.month % 100 == 9) | (pay.month == latest))]
        dump(OUT / "pay" / f"{scope}.json", records(p.drop(columns="department_code")))
        dump(OUT / "segments" / f"{scope}.json", records(seg[seg.scope == scope].drop(columns="scope")))
        dump(OUT / "exposure" / f"{scope}.json",
             records(exposure[exposure.scope == scope].drop(columns="scope").sort_values("month")))
    occ = pd.read_parquet(PUBLISHED / "occupation_fy.parquet").merge(
        names[names.dim == "occ_group"][["code", "name"]], left_on="occ_group", right_on="code", how="left")
    dump(OUT / "occupation_fy.json", records(occ.drop(columns="code")))
    dump(OUT / "reconciliation.json", records(pd.read_parquet(PUBLISHED / "reconciliation.parquet")))
    for f in ("facts.json", "manifest.json", "data_notices.json"):
        shutil.copy(PUBLISHED / f, OUT / f)
    if (PUBLISHED / "models").exists():
        shutil.copytree(PUBLISHED / "models", OUT / "models")
    print(f"web data: {len(kpi.scope.unique())} scopes, latest {latest} -> {OUT}")


if __name__ == "__main__":
    main()
