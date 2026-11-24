"""OPM Federal Workforce Data (FWD) API: list the current version of every file, download one."""
import hashlib
import json
import shutil
import time
import urllib.request
from pathlib import Path

API = "https://data.opm.gov/api/v1/files"
STREAMS = ("employment", "accessions", "separations")


def _open(url: str, attempts: int = 4, json_body: bytes | None = None):
    headers = {"User-Agent": "workforce-atlas"} | ({"Content-Type": "application/json"} if json_body else {})
    for i in range(attempts):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, data=json_body, headers=headers), timeout=600)
        except OSError:
            if i == attempts - 1:
                raise
            time.sleep(5 * 2 ** i)


def catalog() -> dict[tuple[str, int], dict]:
    """{(stream, yyyymm): {"version": int, "publish_date": str}} for every current file."""
    out = {}
    for stream in STREAMS:
        with _open(f"{API}/{stream}?current=true") as r:
            for f in json.load(r):
                out[(stream, int(f["year"] + f["month"]))] = {"version": f["version"], "publish_date": f["publishDate"]}
    return out


def download(stream: str, month: int, version: int, dest: Path) -> Path:
    """Download one file to dest (skipped when already there) and return its path."""
    year, mm = divmod(month, 100)
    path = dest / f"{stream}_{month}_{version}.parquet"
    if not path.exists():
        dest.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix(".part")
        with _open(f"{API}/{stream}/{year}/{mm:02d}/{version}/download") as r, open(part, "wb") as f:
            shutil.copyfileobj(r, f)
        part.rename(path)
    return path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()
