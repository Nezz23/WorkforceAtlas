"""Run every Phase 5 model on the published tables and write data/published/models/*.json.

    python -m models.run
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from models import anomaly, exit_model, forecast, retention
from pipeline import labour, notices

ROOT = Path(__file__).resolve().parents[1]
PUB, OUT = ROOT / "data" / "published", ROOT / "data" / "published" / "models"


def scopes(kpi: pd.DataFrame, minimum: int) -> list[str]:
    latest = kpi[kpi.month == kpi.month.max()]
    big = latest[(latest.scope != "ALL") & (latest.scope != "UNKNOWN") & (latest.headcount >= minimum)]
    return ["ALL"] + big.sort_values("headcount", ascending=False).scope.tolist()


def default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    raise TypeError(type(o))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    kpi = pd.read_parquet(PUB / "kpi_monthly.parquet")
    seg = pd.read_parquet(PUB / "segments_fy.parquet")
    names = pd.read_parquet(PUB / "dim_names.parquet")
    dept_names = dict(names[names.dim == "department"][["code", "name"]].values)
    large, mid = scopes(kpi, 5000), scopes(kpi, 1000)
    gaps = notices.unreliable(notices.load())
    quits = {y: v["rate"] for y, v in labour.by_fiscal_year(labour.load()).items() if v["months"] == 12}
    for name, job in [
        ("forecast", lambda: forecast.run(kpi, large, gaps)),
        ("anomaly", lambda: anomaly.run(kpi, mid, dept_names, gaps)),
        ("retention", lambda: retention.run(seg, large)),
        ("exit_model", lambda: exit_model.run(gaps, quits)),
    ]:
        t0 = time.time()
        result = job()
        (OUT / f"{name}.json").write_text(json.dumps(result, default=default, separators=(",", ":")))
        print(f"{name:<11} {time.time() - t0:6.1f}s")


if __name__ == "__main__":
    main()
