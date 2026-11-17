"""OPM data-quality notices: which department-months OPM says are incomplete, so no model reads a reporting gap
as a change in the workforce.

OPM states missing submissions in its release notes, not in the data files. This step reads the release notes,
turns each "missing records" bullet into (month, stream, department) notices, and applies the reviewed decisions in
ref/data_notices.csv, where a person records when a notice was resolved or adds a gap OPM did not announce. A
notice nobody has reviewed is applied as active, so an unread notice can only make the site more cautious.

    python -m pipeline.notices            # fetch, parse, write data/published/data_notices.json
"""
import csv
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from pipeline.opm import _open

ROOT = Path(__file__).resolve().parents[1]
URL = "https://data.opm.gov/info-and-help/release-notes"
HOME = "https://data.opm.gov/"
REVIEWED = ROOT / "ref" / "data_notices.csv"
OUT = ROOT / "data" / "published" / "data_notices.json"
MONTHS = "January February March April May June July August September October November December".split()
MONTH_RE = re.compile(rf"\b({'|'.join(MONTHS)}) (\d{{4}})\b")
STREAMS = {"Status": ["headcount"], "Dynamics": ["accessions", "separations"]}
DOD_AGENCIES = {"DD", "AF", "AR", "NV"}   # Department of War components, department code DOD in FWD
UNRELIABLE = {"active", "suspected"}


def _text(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split()


def releases(page: str) -> list[dict]:
    """[{release, date, bullets}] oldest first."""
    parts = re.split(r'<h2 class="release-note-heading">', page)[1:]
    out = []
    for p in parts:
        head = re.match(r"Release ([\d.]+) \| ([A-Za-z]+ \d+, \d{4})", p)
        if not head:
            continue
        bullets = [" ".join(_text(b)) for b in re.findall(r"<li>(.*?)</li>", p, flags=re.S)]
        out.append({"release": head[1], "date": datetime.strptime(head[2], "%B %d, %Y").date().isoformat(),
                    "bullets": bullets})
    return sorted(out, key=lambda r: r["date"])


GAP_WORDS = re.compile(r"\b(missing|absent|not (?:yet )?received|incomplete|delayed|not included)\b", re.I)


def departments(text: str) -> list[str]:
    """Department scopes named in a bullet. Component codes come from the list after "components:" (or "provider"),
    or are 4-character codes containing a digit, so words such as EHRI or NASA are never read as codes."""
    listed = re.search(r"(?:components?|providers?)[^:]*:(.*)", text)
    pool = listed[1] if listed else text
    codes = {c for c in re.findall(r"\b([A-Z]{2}[0-9A-Z]{2})\b", pool) if listed or any(ch.isdigit() for ch in c)}
    if "DOW" in text or "Department of War" in text or any(c[:2] in DOD_AGENCIES for c in codes):
        return ["DOD"]
    return sorted({c[:2] for c in codes})


def parse(rels: list[dict], unparsed: list | None = None) -> dict[tuple, dict]:
    """{(month, stream, scope): notice}; a later release overrides an earlier one for the same key. A bullet that
    mentions a data gap but yields no month or department is appended to `unparsed`, so it reaches a person."""
    found: dict[tuple, dict] = {}
    for r in rels:
        published = [int(y) * 100 + MONTHS.index(m) + 1 for b in r["bullets"] if "were published" in b
                     for m, y in MONTH_RE.findall(b)]
        for b in r["bullets"]:
            low = b.lower()
            if not GAP_WORDS.search(b) or "no other significant" in low or "no significant" in low:
                continue
            resolved = "include all previously missing" in low
            months = sorted({int(y) * 100 + MONTHS.index(m) + 1 for m, y in MONTH_RE.findall(b)}) or published[-1:]
            streams = [s for k, v in STREAMS.items() if k in b for s in v] or [s for v in STREAMS.values() for s in v]
            # A count belongs to the files (Status or Dynamics) its sentence names, else the last ones named before it.
            n, n_streams, named = None, [], streams
            for sentence in re.split(r"(?<=\.)\s+", b):
                named = [s for k, v in STREAMS.items() if k in sentence for s in v] or named
                if m := re.search(r"approximately ([\d,]+) missing", sentence):
                    n, n_streams = int(m[1].replace(",", "")), named
            if not months or not departments(b):
                if unparsed is not None:
                    unparsed.append({"source": f"OPM release {r['release']} ({r['date']})", "text": b})
                continue
            for month in months:
                for stream in streams:
                    for scope in departments(b):
                        found[(month, stream, scope)] = {
                            "month": month, "stream": stream, "scope": scope,
                            "status": "resolved" if resolved else "active", "records_missing": n if stream in n_streams else None,
                            "source": f"OPM release {r['release']} ({r['date']})", "url": URL, "text": b, "reviewed": False}
    return found


def apply_reviewed(found: dict[tuple, dict], rows: list[dict]) -> list[dict]:
    for row in rows:
        if None in row or row["status"] not in UNRELIABLE | {"resolved"} or row["stream"] not in ("headcount", "accessions", "separations"):
            raise ValueError(f"bad row in {REVIEWED.name}: {row}")
        key = (int(row["month"]), row["stream"], row["scope"])
        base = found.get(key, {"month": key[0], "stream": key[1], "scope": key[2], "records_missing": None,
                               "url": row["url"] or URL, "text": ""})
        found[key] = {**base, "status": row["status"], "source": row["source"], "note": row["note"], "reviewed": True}
    return sorted(found.values(), key=lambda n: (n["month"], n["scope"], n["stream"]))


def banner(page: str) -> str | None:
    m = re.search(r"Incomplete Data:</b>(.*?)See <a", page, flags=re.S)
    return " ".join(_text(m[1])) if m else None


def unreliable(notices: list[dict]) -> set[tuple[str, int, str]]:
    """{(scope, month, stream)} not to be read as workforce change. A gap in any department is a gap in ALL."""
    out = set()
    for n in notices:
        if n["status"] in UNRELIABLE:
            out |= {(n["scope"], n["month"], n["stream"]), ("ALL", n["month"], n["stream"])}
    return out


def load(path: Path = OUT) -> list[dict]:
    return json.loads(path.read_text())["notices"] if path.exists() else []


def main() -> None:
    try:
        with _open(URL) as r:
            page = r.read().decode()
        with _open(HOME) as r:
            home = r.read().decode()
    except OSError as e:
        # Keep the last notices rather than stop the month: the reviewed CSV still applies, and the run opens an issue.
        if not OUT.exists():
            raise
        prev = json.loads(OUT.read_text())
        prev["fetch_error"] = f"{type(e).__name__}: {e}"
        OUT.write_text(json.dumps(prev, indent=1))
        print(f"WARNING: could not fetch OPM release notes ({e}); kept {len(prev['notices'])} notices from {prev['fetched_at']}")
        return
    rels = releases(page)
    if not rels:
        raise RuntimeError(f"no releases parsed from {URL}; the page layout may have changed")
    unparsed: list = []
    with REVIEWED.open() as f:
        notices = apply_reviewed(parse(rels, unparsed), list(csv.DictReader(f)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "source": URL,
        "latest_release": rels[-1]["release"], "banner": banner(home), "notices": notices,
        "unreviewed": [n for n in notices if not n["reviewed"]], "unparsed": unparsed, "fetch_error": None,
    }, indent=1))
    for n in notices:
        print(f"{n['month']} {n['stream']:<11} {n['scope']:<4} {n['status']:<9} {'' if n['reviewed'] else 'UNREVIEWED'}")


if __name__ == "__main__":
    main()
