"""Build idempotency, sources.json atomicity, warehouse completeness and the recomputed quality profile."""
import json
import os

import numpy as np
import pandas as pd
import pytest

from pipeline import build, opm, publish, validate
from pipeline import web as web_out
from tests.conftest import rows


def flow_rows(stream, month, n=1, **over):
    cat = {"separations": "separation_category_code", "accessions": "accession_category_code"}
    code = {"separations": "SC", "accessions": "AA"}
    base = {"employment": {"snapshot_yyyymm": str(month)},
            "separations": {"drp_indicator": "N", "personnel_action_effective_date_yyyymm": str(month)},
            "accessions": {"personnel_action_effective_date_yyyymm": str(month)}}[stream]
    if stream in cat:
        base[cat[stream]] = code[stream]
    return rows(n, **base, **over)


@pytest.fixture
def world(tmp_path, monkeypatch):
    """A fake OPM catalog and downloader, and a warehouse in tmp_path."""
    wh = tmp_path / "warehouse"
    monkeypatch.setattr(build, "WAREHOUSE", wh)
    monkeypatch.setattr(build, "SOURCES", wh / "sources.json")
    monkeypatch.setattr(build, "RAW", tmp_path / "raw")
    w = type("World", (), {})()
    w.versions = {(s, m): 1 for s in opm.STREAMS for m in (202501, 202502)}
    w.downloads = []
    monkeypatch.setattr(opm, "catalog", lambda: {k: {"version": v, "publish_date": "2026-01-01"} for k, v in w.versions.items()})

    def download(stream, month, version, dest):
        w.downloads.append((stream, month, version))
        dest.mkdir(parents=True, exist_ok=True)
        path = dest / f"{stream}_{month}_{version}.parquet"
        pd.DataFrame(flow_rows(stream, month, 3)).astype(str).to_parquet(path)
        return path
    monkeypatch.setattr(opm, "download", download)
    w.wh = wh
    return w


def mtimes(wh):
    return {str(p.relative_to(wh)): p.stat().st_mtime_ns for p in wh.rglob("*.parquet")}


def test_second_run_with_same_versions_downloads_and_rewrites_nothing(world):
    build.main(202501, 202502, False)
    assert len(world.downloads) == 6
    before = mtimes(world.wh)
    world.downloads.clear()
    build.main(202501, 202502, False)
    assert world.downloads == [] and mtimes(world.wh) == before


def test_bumped_version_rebuilds_only_that_file(world):
    build.main(202501, 202502, False)
    before = mtimes(world.wh)
    world.downloads.clear()
    world.versions[("separations", 202502)] = 2
    build.main(202501, 202502, False)
    after = mtimes(world.wh)
    assert world.downloads == [("separations", 202502, 2)]
    assert [k for k in after if after[k] != before[k]] == ["separations/202502.parquet"]
    assert json.loads(build.SOURCES.read_text())["separations"]["202502"]["version"] == 2


def test_sources_records_raw_file_sha256(world):
    build.main(202501, 202501, False)
    entry = json.loads(build.SOURCES.read_text())["accessions"]["202501"]
    assert len(entry["sha256"]) == 64 and entry["rows"] == 3


def test_failed_sources_write_keeps_the_previous_file(world, monkeypatch):
    build.main(202501, 202501, False)
    good = build.SOURCES.read_text()

    def boom(*a):
        raise OSError("disk full")
    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        build.write_sources({"employment": {}, "separations": {}, "accessions": {}})
    assert build.SOURCES.read_text() == good


def test_contract_failure_leaves_the_last_good_sources(world, monkeypatch):
    build.main(202501, 202501, False)
    good = build.SOURCES.read_text()
    world.versions[("employment", 202501)] = 2
    world.versions[("employment", 202502)] = 1
    def broken(stream, month, version, dest):
        dest.mkdir(parents=True, exist_ok=True)
        path = dest / f"{stream}_{month}_{version}.parquet"
        pd.DataFrame(flow_rows(stream, month, 1, count="2")).astype(str).to_parquet(path)
        return path
    monkeypatch.setattr(opm, "download", broken)
    with pytest.raises(validate.ContractError, match="bad_count"):
        build.main(202501, 202501, False)
    assert build.SOURCES.read_text() == good


def test_many_unknown_los_in_a_flow_file_stops(write, tmp_path):
    recs = flow_rows("accessions", 202509, 3) + flow_rows("accessions", 202509, 2, length_of_service_years=None)
    with pytest.raises(validate.ContractError, match=r"unknown length of service for 40\.0% of rows \(limit 25%\)"):
        validate.check(build.connect(write("a", recs), 202509), "accessions", 202509, None)


def test_some_unknown_los_in_a_flow_file_only_warns(write):
    recs = flow_rows("accessions", 202509, 11) + flow_rows("accessions", 202509, 1, length_of_service_years=None)
    profile = validate.check(build.connect(write("a", recs), 202509), "accessions", 202509, None)
    assert profile["warnings"] == ["length of service missing for 8.3% of rows"]


def test_complete_months_across_a_year_end_pass():
    months = {s: {202511, 202512, 202601} for s in opm.STREAMS}
    publish.assert_complete(months)


def test_a_missing_month_in_one_stream_stops():
    months = {"employment": {202511, 202512, 202601}, "separations": {202511, 202601}, "accessions": {202511, 202512, 202601}}
    with pytest.raises(validate.ContractError, match="separations is missing 1 months, first 202512"):
        publish.assert_complete(months)


def test_streams_ending_in_different_months_stop():
    months = {"employment": {202511, 202512}, "separations": {202511}, "accessions": {202511, 202512}}
    with pytest.raises(validate.ContractError, match="different months"):
        publish.assert_complete(months)


def cube(wh, name, month, n, unknown=0, no_dept=0):
    df = pd.DataFrame({"month": [month] * 3, "department_code": ["AG", None, "No Data Reported"],
                       "los_band": ["3-4", "Unknown", "3-4"], "n": [n - unknown - no_dept, unknown, no_dept]})
    (wh / name).mkdir(parents=True, exist_ok=True)
    df.to_parquet(wh / name / f"{month}.parquet")


def profile_for(tmp_path, sep_unknown):
    import duckdb
    for month in (202209, 202309, 202409):
        for name in ("headcount", "separations", "accessions"):
            cube(tmp_path, name, month, 100)
    cube(tmp_path, "headcount", 202509, 100)
    cube(tmp_path, "accessions", 202509, 100)
    cube(tmp_path, "separations", 202509, 300, unknown=sep_unknown, no_dept=30)
    return publish.quality_profile(duckdb.connect(), tmp_path)


def test_quality_profile_is_recomputed_from_the_cubes(tmp_path):
    q = profile_for(tmp_path, sep_unknown=15)
    sep = q["streams"]["separations"]["2025-09"]
    assert sep["rows"] == 300 and sep["unknown_los_share"] == 0.05 and sep["null_department_share"] == 0.15
    assert sep["median_same_month_3y"] == 100 and sep["ratio_to_median"] == 3.0
    assert q["streams"]["separations"]["2022-09"]["ratio_to_median"] is None
    assert q["warnings"]["separations 202509"] == ["3.00x the same-month 3-year median", "department missing for 15.00% of rows"]


def test_quality_profile_stops_above_25_percent_unknown_los(tmp_path):
    with pytest.raises(validate.ContractError, match="unknown length of service 30.0%"):
        profile_for(tmp_path, sep_unknown=90)


def test_web_json_writes_numpy_numbers_and_rejects_other_types(tmp_path):
    web_out.dump(tmp_path / "a.json", {"n": np.int64(3), "x": np.float64(0.5), "b": np.bool_(True)})
    assert json.loads((tmp_path / "a.json").read_text()) == {"n": 3, "x": 0.5, "b": True}
    with pytest.raises(TypeError, match="cannot serialize"):
        web_out.dump(tmp_path / "b.json", {"when": pd.Timestamp("2026-01-01")})
