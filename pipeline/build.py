"""Fetch -> validate -> cube, one FWD file at a time, into data/warehouse (one Parquet file per cube and month).

Only files whose OPM version differs from the warehouse are processed, so a run is incremental and a re-versioned
month is rebuilt. Raw files are deleted after use. A broken data contract stops the run and leaves the last good
warehouse in place.

    python -m pipeline.build [--start 201112] [--end 202609] [--keep-raw]
"""
import argparse
import json
import os
import time
from pathlib import Path

import duckdb

from pipeline import opm, validate

ROOT = Path(__file__).resolve().parents[1]
SQL, WAREHOUSE, RAW = ROOT / "sql", ROOT / "data" / "warehouse", ROOT / "data" / "raw"
SOURCES = WAREHOUSE / "sources.json"
FIRST_MONTH = 201112   # employment is monthly from 2011-06; 2011-12 is the opening stock for January 2012
CUBES = {
    "employment": ["headcount", "pay", "pay_quantiles", "names"],
    "separations": ["separations"],
    "accessions": ["accessions"],
}


def connect(path: Path, month: int) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute((SQL / "macros.sql").read_text())
    con.execute(f"create view src as select *, {int(month)} as _month from read_parquet('{path}')")
    return con


def process(path: Path, stream: str, month: int, previous: dict | None) -> dict:
    con = connect(path, month)
    profile = validate.check(con, stream, month, previous)
    for cube in CUBES[stream]:
        out = WAREHOUSE / cube / f"{month}.parquet"
        out.parent.mkdir(parents=True, exist_ok=True)
        part = out.with_suffix(".part")
        con.execute(f"copy ({(SQL / f'cube_{cube}.sql').read_text()}) to '{part}' (format parquet, compression zstd)")
        part.rename(out)
    return profile


def write_sources(sources: dict) -> None:
    """Atomic: a crash leaves the previous sources.json, never a half-written one."""
    tmp = SOURCES.with_suffix(".tmp")
    tmp.write_text(json.dumps(sources, indent=1, sort_keys=True))
    os.replace(tmp, SOURCES)


def previous_month(month: int) -> int:
    year, mm = divmod(month, 100)
    return (year - 1) * 100 + 12 if mm == 1 else month - 1


def main(start: int, end: int | None, keep_raw: bool) -> None:
    catalog = opm.catalog()
    WAREHOUSE.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text()) if SOURCES.exists() else {s: {} for s in opm.STREAMS}
    months = sorted(m for s, m in catalog if s == "employment" and m >= start and (end is None or m <= end))
    for month in months:
        for stream in opm.STREAMS:
            info = catalog[(stream, month)]
            have = sources[stream].get(str(month))
            if have and have["version"] == info["version"]:
                continue
            t0 = time.time()
            path = opm.download(stream, month, info["version"], RAW)
            digest = opm.sha256(path)
            profile = process(path, stream, month, sources[stream].get(str(previous_month(month))))
            # sources.json is written only after the cubes of this file are in place: it is the record of what is done.
            sources[stream][str(month)] = {**info, **profile, "sha256": digest}
            write_sources(sources)
            if not keep_raw:
                path.unlink()
            flag = f"  WARN {profile['warnings']}" if profile["warnings"] else ""
            print(f"{stream:<11} {month} v{info['version']} {profile['rows']:>9,} rows {time.time() - t0:5.1f}s{flag}",
                  flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--start", type=int, default=FIRST_MONTH)
    p.add_argument("--end", type=int)
    p.add_argument("--keep-raw", action="store_true")
    a = p.parse_args()
    main(a.start, a.end, a.keep_raw)
