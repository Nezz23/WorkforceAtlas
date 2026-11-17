"""Fetch OPM's General Schedule base pay tables (no locality) into ref/gs_base_pay.csv.

OPM serves 2014 onward at the URL below; 2012 and 2013 redirect to the index page, so those years are not sourced
and derived pay is unavailable for them.

    python -m pipeline.gs_table
"""
import csv
import re
import urllib.request
from pathlib import Path

URL = "https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/salary-tables/{yy}Tables/html/GS.aspx"
OUT = Path(__file__).resolve().parents[1] / "ref" / "gs_base_pay.csv"
YEARS = range(2014, 2027)


def cells(row: str) -> list[str]:
    return [re.sub(r"<[^>]+>|&nbsp;|\s+", " ", c).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S)]


def parse(html: str, year: int) -> list[dict]:
    text = re.sub(r"<[^>]+>|\s+", " ", html)
    effective = re.search(r"(?i)effective\s+(january\s+\d{4})", text).group(1).title()
    if not effective.endswith(str(year)):
        raise ValueError(f"{year}: page says effective {effective}")
    table = html[html.index('<table class="DataTable"'):]
    rows = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", table[:table.index("</table>")], re.S)]
    if rows[0][:11] != ["Grade"] + [f"Step {s}" for s in range(1, 11)] or [r[0] for r in rows[1:]] != [str(g) for g in range(1, 16)]:
        raise ValueError(f"{year}: unexpected table layout")
    return [{"year": year, "grade": f"{int(r[0]):02d}", "step": f"{s:02d}", "annual_rate": int(r[s].replace(",", "")),
             "effective": effective, "source": URL.format(yy=year % 100)}
            for r in rows[1:] for s in range(1, 11)]


def main() -> None:
    out = []
    for year in YEARS:
        req = urllib.request.Request(URL.format(yy=year % 100), headers={"User-Agent": "Mozilla/5.0"})
        out += parse(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"), year)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print(f"{len(out)} rates, {YEARS[0]}-{YEARS[-1]} -> {OUT}")


if __name__ == "__main__":
    main()
