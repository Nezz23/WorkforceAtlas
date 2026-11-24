"""Private-sector quit rate (BLS JOLTS), the labour-market signal the exit model uses to set each year's level.

Federal voluntary exits rise and fall with outside job options: the exit model's yearly misses tracked the private
quit rate (models/exit_model.py). The series is the seasonally adjusted private-sector quits rate, which does not
include federal separations, so the deferred resignation program cannot leak into it.

    python -m pipeline.labour            # fetch, write data/published/labour_quits.csv
"""
import csv
import json
from datetime import date
from pathlib import Path

from pipeline.opm import _open

ROOT = Path(__file__).resolve().parents[1]
SERIES = "JTS100000000000000QUR"   # JOLTS quits rate, total private, seasonally adjusted, percent
API = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
SOURCE = f"https://data.bls.gov/timeseries/{SERIES}"
FIRST = 2014
OUT = ROOT / "data" / "published" / "labour_quits.csv"


def fetch(first: int = FIRST, last: int | None = None) -> dict[int, float]:
    """{yyyymm: rate}. The keyless v1 API returns at most 10 years per request."""
    last = last or date.today().year
    out = {}
    for start in range(first, last + 1, 10):
        body = json.dumps({"seriesid": [SERIES], "startyear": str(start), "endyear": str(min(start + 9, last))}).encode()
        with _open(API, json_body=body) as r:
            d = json.load(r)
        if d.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError(f"BLS API: {d.get('status')} {d.get('message')}")
        for p in d["Results"]["series"][0]["data"]:
            if p["period"].startswith("M") and p["period"] != "M13":
                out[int(p["year"]) * 100 + int(p["period"][1:])] = float(p["value"])
    if not out:
        raise RuntimeError(f"BLS API returned no observations for {SERIES}")
    return out


def by_fiscal_year(rates: dict[int, float]) -> dict[int, dict]:
    """{fy: {"rate": mean, "months": n}}; fiscal year y runs October y-1 to September y."""
    fy: dict[int, list[float]] = {}
    for m, v in rates.items():
        fy.setdefault(m // 100 + (m % 100 >= 10), []).append(v)
    return {y: {"rate": sum(v) / len(v), "months": len(v)} for y, v in sorted(fy.items())}


def load(path: Path = OUT) -> dict[int, float]:
    with path.open() as f:
        return {int(r["month"]): float(r["rate"]) for r in csv.DictReader(f)}


def main() -> None:
    try:
        rates = fetch()
    except (OSError, RuntimeError, ValueError, KeyError, IndexError) as e:   # network, API status, malformed JSON
        # Keep the last series rather than stop the month; a change in BLS's API must not block OPM's refresh.
        if not OUT.exists():
            raise
        print(f"WARNING: could not fetch {SERIES} ({e}); kept {OUT.name}")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    with tmp.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["month", "rate"])
        w.writerows(sorted(rates.items()))
    tmp.replace(OUT)
    print(f"{SERIES}: {len(rates)} months, {min(rates)} to {max(rates)}")


if __name__ == "__main__":
    main()
