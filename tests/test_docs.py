"""The written model notes and README quote the published model outputs; a figure that drifts from the JSON fails here.
Skipped when the published data is not present (it ships as a release asset, not in git)."""
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "data" / "published" / "models"
pytestmark = pytest.mark.skipif(not (MODELS / "forecast.json").exists(), reason="published data not present")


def load(name: str) -> dict:
    return json.loads((MODELS / f"{name}.json").read_text())


def quoted() -> list[tuple[str, str]]:
    """(file, text that must appear in it), built from the JSON."""
    f, e = load("forecast"), load("exit_model")
    out = []
    for r in e["excess"]:
        if r["dept"] == "ALL":
            out.append(("docs/05-models.md", f"| FY{r['fy']} | {r['ratio']:.2f} "))
            out.append(("docs/05-models.md", f"{r['ratio_excl_drp']:.2f} ({r['ratio_excl_drp_lo']:.2f}–{r['ratio_excl_drp_hi']:.2f})"))
            if r["fy"] == 2025:
                out.append(("README.md", f"{r['ratio']:.2f} times the expected level, or {r['ratio_excl_drp']:.2f} times"))
    lm = e["labour_market"]
    out.append(("docs/05-models.md", f"b1 = {lm['b1']:.3f} (SE {lm['se']:.3f}"))
    fl = f["forecasts"]["ALL"]["flows"]
    out.append(("docs/05-models.md", f"{fl['hires_12']:,} hires − {fl['exits_12']:,} exits − {-fl['other_12']:,} other"))
    for lv, label in (("government-wide", "Government-wide"), ("departments", "Departments")):
        t = f["intervals"]["scores_80"]["adaptive"][lv]["test"]
        out.append(("docs/05-models.md", f"| {label} | **Adaptive** | "))
        out.append(("docs/05-models.md", f"{t['coverage']:.1f}% /"))
    out.append(("README.md", f"{e['gain_vs_baseline_test_pct']:.1f}% below a department-average baseline"))
    return out


@pytest.mark.parametrize("path,text", quoted())
def test_docs_quote_the_published_figures(path, text):
    assert text in (ROOT / path).read_text(), f"{path} no longer quotes: {text}"
