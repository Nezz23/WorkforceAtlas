# Workforce Atlas: Phase 2 Product Design

- **Date:** 2026-11-15
- **Name:** provisional
- **Status:** for approval before Phase 3. No code written.

**Labels used throughout this document:**

| Label | Meaning |
|---|---|
| **VERIFIED** | Measured today from OPM files |
| **UNVERIFIED** | Assumption to confirm |
| **DESIGN** | A decision proposed here |

**Data source:** OPM Federal Workforce Data (FWD), `https://data.opm.gov/api/v1/files/{employment,accessions,separations}`. Files inspected: employment 2026-09, accessions 2026-09, separations 2015-09, 2025-09, 2025-10 and 2026-09.

---

## 0. What the data can and cannot do (read first)

| # | Fact | Status | Consequence |
|---|---|---|---|
| L1 | No person identifier in any file | VERIFIED | No individual tracking, no true cohorts, no individual predictions. Cohorts are approximated from length of service (§5.3). |
| L2 | Employment is **quarterly 2005–2010** (4 files/yr), partly monthly in 2011, **monthly from 2012** | VERIFIED (API list: 209 current employment files, 2005-03 → 2026-09) | Monthly models start 2012-01. Long-run views use quarters. |
| L3 | Pay is redacted or null for **47.1%** of on-board records (Sep 2026; corrected 2026-11-16 from a miscalculated 46.9%), concentrated in Navy, Army, DHS, Air Force, DoD and DOJ | VERIFIED (946,462 REDACTED + 3,648 null of 2,017,021) | Pay results describe only the **visible half** of the workforce unless pay is reconstructed (§5.7). Every pay chart shows coverage. Cause confirmed in OPM’s Data Release Policy (docs/reference/verification.md). |
| L4 | 99.8% of redacted-pay records keep **pay plan, grade and step**; 57% of them are GS | VERIFIED | GS **base** pay can be derived from the public GS table (locality excluded). Labelled "derived". |
| L5 | No sex, race, disability or performance rating at person level | VERIFIED (absent from all 4 schemas) | No pay-equity or performance analysis by protected class. Not built and not simulated. |
| L6 | Location is redacted for about 27% of separations | VERIFIED (Sep 2026) | Geography is a secondary view only, with coverage shown. |
| L7 | The separations schema was identical in 2015 and 2026 (69 fields). Accessions has 68 fields and employment 64. | VERIFIED | Stable enough for one pipeline; still validated per file. |
| L8 | OPM republishes revised versions (e.g. June 2026 is version 4) | VERIFIED | The pipeline tracks the version per month and reprocesses when it changes. |
| L9 | Recruitment funnel, time to hire, cost per hire and engagement per person do not exist in FWD | VERIFIED (absent) | Out of scope. Hiring **volume and type** (accessions) are in scope. |
| L10 | Agency codes and structures change over 20 years (reorganisations) | UNVERIFIED (expected) | Phase 3 builds a code-history table; trends cross reorgs with a flag. |
| L11 | Snapshot date convention (end of month?) and whether accessions/separations fully reconcile headcount change | UNVERIFIED | Phase 3 measures the reconciliation gap and publishes it. |
| L12 | FY-end seasonality: September has many expired-appointment terminations (9,621 in Sep 2015) | VERIFIED | Every model must handle seasonality; YoY uses the same month. |
| L13 | Data dictionary download returns an empty file to scripts | VERIFIED | Category mappings (§3) are provisional until the dictionary is read. |

---

## 1. The story: "The Changing Federal Workforce"

Workforce Atlas is built around one narrative, told across its four modules. The opening chapter is real and large:

> **September 2025: 120,540 federal separations, 96,177 of them flagged under the deferred resignation program (DRP).** September 2015, by comparison, had 24,543. *(VERIFIED counts. The program's name and dates come from public reporting and are confirmed in Phase 3. Present neutrally: no political framing.)*

| Chapter | Question | Module |
|---|---|---|
| 1 Shape | What does the federal workforce look like, and how was it changing before 2025 (age, tenure, occupation mix)? | Executive Intelligence |
| 2 Shock | How large was the 2025 exit wave against 2012–2024 history, and who left: which agencies, occupations, grades, tenure and age bands? | Mobility & Retention |
| 3 Experience | How many **years of federal experience** left, and in which occupations? | Mobility & Retention |
| 4 Replacement | Did hiring replace the exits, by volume and by type (competitive, excepted, SES)? | Planning & Forecasting |
| 5 Pay | What does pay structure look like where it is visible, and what changes when hidden GS pay is derived? | Compensation |
| 6 Next | Where is headcount heading under current flows, and what changes under alternative scenarios? | Planning & Forecasting |

**Story rule:** every chapter opens with one sentence generated from computed facts, then the chart that proves it, then the method note.

---

## 2. Business questions (each maps to a KPI, a method and a view)

| ID | Business question | KPIs | Method | View |
|---|---|---|---|---|
| Q1 | How many people work for the federal government, and how has that changed since 2012? | Headcount, net change | Descriptive; YoY with Poisson CI | Executive: hero trend |
| Q2 | Which departments grew or shrank most in the last 12 months, against their own 2012–24 range? | Net change %, percentile vs history | Historical percentile band | Executive: ranked slope chart |
| Q3 | Is the current month unusual for any department or separation type? | Separations by category | Seasonal robust anomaly (§5.2) | Executive: alert list, Mobility heatmap |
| Q4 | How did 2025 separations compare to history, by type (quit, retirement, DRP, RIF, termination)? | Separation rate by category | Expected vs actual, excess separations with interval | Mobility: excess bar + timeline |
| Q5 | Who left: which tenure bands, age bands, grades and occupations were over-represented relative to their share of headcount? | Separation rate by segment, rate ratio | Rate ratios with CIs, BH-adjusted | Mobility: rate-ratio dot plot |
| Q6 | How much experience left? | Years of service lost, by occupation | Sum of length of service of separations | Mobility: treemap → table |
| Q7 | How long do new federal employees stay, and has early-tenure retention changed? | Tenure-specific separation hazard, implied survival | Synthetic-cohort life table (§5.3) | Mobility: survival curves by period |
| Q8 | Which workforce segments have structurally higher separation rates, after controlling for the others? | Expected rate, drivers | Poisson GLM + GBM with SHAP (§5.4) | Mobility: driver chart, segment table |
| Q9 | Is hiring replacing exits, and with what appointment types? | Accession rate, replacement ratio (A/S) | Descriptive + forecast | Planning |
| Q10 | Where will headcount be in 6/12/24 months if flows continue? | Headcount forecast, intervals | Stock-flow forecast with backtest (§5.1) | Planning |
| Q11 | What happens under a hiring freeze, a retirement wave or a targeted exit program? | Scenario headcount, experience, base-pay run-rate | Segment stock-flow simulator (§5.5) | Planning: scenario panel |
| Q12 | How is pay distributed by grade, occupation and department, and how much of the workforce can we see? | Median pay, IQR, coverage % | Observed + derived GS base pay (§5.7) | Compensation |
| Q13 | Where do observed pay values look inconsistent with pay plan, grade and step? | Off-table pay flags | Rule-based check vs GS table | Compensation: data-quality panel |

---

## 3. KPI definitions (DESIGN; formulas locked in Phase 3 after reading the data dictionary)

**Notation:** `H(t)` = headcount in month t; `A(t)` = accessions in month t; `S(t)` = separations in month t; average headcount `Ĥ(t) = (H(t−1) + H(t)) / 2`.

| KPI | Formula | Grain | Fields | Caveat |
|---|---|---|---|---|
| Headcount | `H(t)` = rows in employment file t | month × segment | employment | Snapshot convention L11 |
| Net change | `H(t) − H(t−1)` | month × segment | | Quarterly before 2012 |
| Reconciliation gap | `ΔH − (A − S)` | month × department | all 3 | Published, not hidden |
| Separation rate | `S / Ĥ`; annualized = monthly × 12 | month × segment | separations | Small-n rule below |
| Rate by type | Same, split by `separation_category` | | `separation_category` | Category mapping from dictionary |
| Voluntary rate | QUIT + RETIREMENT-VOLUNTARY + RETIREMENT-EARLY OUT | | | DRP shown **separately** via `drp_indicator`; early-out is employer-offered |
| Involuntary rate | RIF + TERMINATION (when not an expired appointment) | | | "Expired appointment" is mixed into one category, VERIFIED; it may not be separable |
| DRP separations | count where `drp_indicator = Y` | | `drp_indicator` | Only meaningful for 2025+ |
| Accession rate | `A / Ĥ`, by `accession_category` | | accessions | |
| Replacement ratio | `A / S` over a rolling 12 months | | | |
| Experience lost | Σ `length_of_service_years` over separations | | | Includes prior federal service |
| Early-tenure attrition | Separations with service < 1 and < 2 years ÷ headcount in the same band | | | |
| Retirement exposure (proxy) | Share of headcount in (age ≥ 55 and service ≥ 30) or (age ≥ 60 and service ≥ 20) or (age ≥ 62 and service ≥ 5) | | age bracket, service | **Proxy**: true eligibility depends on retirement system and birth year; age is bracketed |
| Observed pay | Median and IQR of `annualized_adjusted_basic_pay`, unredacted records only | | | Always shown with coverage % |
| Derived GS base pay | GS table lookup (grade, step, year); **excludes locality** | GS records only | `pay_plan`, `grade`, `step_or_rate_type` | Labelled "derived"; validated against unredacted GS rows |
| Pay coverage | Observed-pay records ÷ headcount | | | |
| Base-pay run-rate | Σ observed pay + Σ derived GS base; non-GS redacted shown as a gap | | | Not payroll cost: no benefits or locality on derived rows |

**Small-n rule:** rates with a denominator under 30 show "too few" instead of a number, and a CI is shown whenever n < 1,000. *(This is about statistical reliability. The records are already public.)*

**Segments:**

- department / agency / sub-element
- occupational group / series
- grade band: GS 1–7 / 8–12 / 13–15 / SES / other plans
- tenure band: < 1, 1–2, 3–4, 5–9, 10–19, 20–29, 30+
- age bracket (as published)
- supervisory status
- work schedule
- appointment type

---

## 4. Data engineering strategy

```
 data.opm.gov API (manifest: filename, version, publishDate)
        │  monthly GitHub Actions cron + manual "rebuild" dispatch
        ▼
 pipeline/fetch.py ── downloads only new or re-versioned files ──> runner temp disk (deleted after)
        ▼
 pipeline/validate.py ── schema contract (expected columns and types), row count vs ±40% of prior month,
        │               redaction % per column, category values in the known set, duplicates
        │               ✗ any failure: stop, open issue, keep the last good data
        ▼
 sql/*.sql (DuckDB) ── one documented query per cube:
        │   cube_headcount   month × segment → H, observed pay sum/n, service sum
        │   cube_separations month × segment × category × drp → S, service sum
        │   cube_accessions  month × segment × category → A
        │   ref_agency_history, ref_gs_pay_table, ref_categories
        ▼
 data/published/*.parquet  (committed; target < 25 MB total for the browser)
 data/published/facts.json (every number a narrative may cite, with id and query)
 data/published/manifest.json (source file versions, run time, validation results)
        ▼
 models/*.py ── forecasts, anomalies, life tables, segment model, backtests → data/published/models/*.json
        ▼
 Next.js on Vercel: reads data/published; DuckDB-WASM for filters and drill-down; static report route → PDF
```

| Decision | Why |
|---|---|
| Raw files are never committed | About 140 employment files × 26–75 MiB ≈ 7 GB for FY2015+ |
| Cubes are committed | Reproducible and diffable; the app needs no backend |
| One file at a time, then deleted | Fits the Actions runner disk; a full rebuild is about 140 × 2M rows. Runtime is UNVERIFIED and measured in Phase 3. |
| Version-aware | OPM revises months (L8); the manifest records which version each number came from |
| Small cubes | Cube size is the main risk to browser performance. If it exceeds 25 MB, publish two levels (department-level full detail; sub-element only on drill-down). |
| Tests | Pipeline: schema contract, KPI fixtures on a 100-row sample, reconciliation. Models: backtest no-leakage test (as in RetailPulse). |

**Window:** monthly analysis from **2012-01**, quarterly context from 2005, latest month 2026-09.

---

## 5. Analytical methodology

### 5.1 Forecasting: a stock-flow model, not a headcount curve
- Forecast **flows** (accession rate and separation rate by type), then roll the stock forward: `H(t+1) = H(t) + A − S`. Scenarios (5.5) and the forecast then share one model.
- **Models per flow:**
  - seasonal naive (baseline)
  - ETS
  - SARIMAX with Fourier seasonality and a **2025 intervention term**, so the shock is not learned as the new normal
  - equal-weight combination
- **Validation:** rolling-origin backtest, 12+ origins from 2016–2024, horizons 6, 12 and 24 months. Metrics: WAPE, bias and interval coverage. A separate scored fold through 2025 shows how badly every model misses a policy shock, and that is stated plainly.
- **Uncertainty:** model intervals, checked against empirical backtest coverage. Fan charts.
- **Hierarchy:** forecast at department level, sum to the government-wide total, and compare with a direct top-level forecast.

### 5.2 Anomaly detection
- **Unit:** department × separation category × month.
- **Expected value:** same calendar month, median of the prior 5 years (excluding the month being scored).
- **Score:** robust z on the log ratio, with a MAD scale pooled per series.
- **Thresholds:** calibrated by null simulation to fewer than 1% false flags. The RetailPulse method transfers directly.
- **Level shifts:** a simple CUSUM on the scored series separates sustained shifts from one-month spikes.
- Each flag carries its context: size, history range, categories driving it and DRP share.

### 5.3 Cohort-level analysis without person IDs: a synthetic-cohort life table
- Tenure-specific separation hazard: `h_b(period) = S_b / Ĥ_b` for each tenure band b.
- Chain the hazards into an implied survival curve: "of 100 people hired, how many remain after 1, 2, 5 and 10 years under this period's rates".
- Compare periods: 2015–19, 2020–21, 2022–24 and 2025–26, with bootstrap CIs over months.
- **Honest limits:**
  - Length of service includes prior federal (and some military) service, so "tenure" means federal service, not time at the agency.
  - Transfers between agencies appear as exit and entry at the agency level. Report survival government-wide first.

### 5.4 Segment separation-rate model (aggregate only, never individual)
- **Data:** cells of department × occupational group × grade band × tenure band × age bracket × supervisory × year.
- **Target:** voluntary separations, with log(headcount) as an exposure offset.
- **Models:**
  - Poisson/negative-binomial GLM: interpretable rate ratios with CIs
  - gradient boosting (scikit-learn HistGradientBoosting, Poisson loss) + SHAP
  - baseline: department × year base rate
- **Validation:** time split (train FY2015–22, validate FY2023, test FY2024). 2025 is excluded from training and reported as **out-of-distribution**. Metrics: Poisson deviance, calibration by decile, and the gain over the baseline. If the GBM doesn't beat the GLM, ship the GLM.
- **Use:** "segments with expected rates well above their department" for planning. No individual scores exist.
- **Fairness note:** age bracket is a feature because retirement depends on age. The model card explains this and shows results with and without age.

### 5.5 Interactive scenario simulator
- Runs in the browser on the segment stock-flow cube. The arithmetic is simple and transparent.
- **Levers:**
  - hiring rate (% of baseline, by department)
  - voluntary separation multiplier
  - retirement uptake among the exposure proxy
  - a one-time targeted exit (size, segments)
  - horizon
- **Outputs:**
  - headcount path, with the baseline forecast band
  - experience retained
  - base-pay run-rate (observed + derived, labelled)
  - comparison of up to 3 saved scenarios side by side
- Shows what the levers assume, and refuses to go outside the historical range unless the user confirms.

### 5.6 Statistical testing
- Rates: exact Poisson CIs.
- Differences: rate ratios with CIs.
- Many departments or segments: Benjamini–Hochberg FDR.
- **Language rule:** "higher than" only when the CI excludes 1 *and* the effect is above a set materiality threshold.

### 5.7 Compensation, within the limits
- Observed pay distribution by grade and occupation on unredacted records, always with coverage.
- **Derived GS base pay** for redacted GS rows from OPM's published GS base table (the table's availability per year is UNVERIFIED, Phase 3).
  - Validation: on *unredacted* GS rows, compare derived base pay with observed adjusted pay. The gap is roughly locality, so report its distribution.
  - Label everywhere: "derived base pay, excludes locality".
- **Off-table checks:** observed pay outside the plausible range for plan, grade, step and year → data-quality flag, not an "anomalous employee".
- Out of scope:
  - pay equity by sex or race (no data)
  - BLS OEWS benchmarking (the OPM-series-to-SOC crosswalk is UNVERIFIED; revisit after the core is done)

### 5.8 Automated executive reporting
- `facts.json`: every reportable number with an id, value, CI, comparison, the query that produced it, and the source file versions.
- **Narrative engine:** rules pick the facts that pass significance and materiality thresholds, and templates turn them into sentences. Each sentence links to its fact id. **No free-text generation in v1.** An optional LLM rewrite step must reproduce every number exactly, or it is discarded.
- **Output:** a monthly "Workforce Brief" route, printed to PDF in Actions (headless Chrome) and attached to the run, as in the RetailPulse weekly report.

---

## 6. Product architecture

| Module | Primary questions | Key views |
|---|---|---|
| **Executive Intelligence** | Q1–Q3 | Brief headline (from facts), 4 KPI tiles vs historical band, headcount trend with annotated events, department movers, active alerts, "download brief" |
| **Workforce Mobility & Retention** | Q4–Q8 | Excess separations timeline, separation mix, who-left rate ratios, experience lost, survival curves by period, segment drivers |
| **Workforce Planning & Forecasting** | Q9–Q11 | Flow forecast fan chart, replacement ratio, backtest scorecard, scenario simulator with comparison |
| **Compensation Intelligence** | Q12–Q13 | Coverage banner, pay by grade (observed vs derived), occupation pay ladders, off-table data-quality panel |
| Methods & Data | all | Definitions, coverage, pipeline status (manifest), model cards, limitations L1–L13 |

**Global filters** (persist across modules, stored in the URL):

- time range
- department → agency
- occupational group
- grade band
- tenure band

**Contextual filters** are local to one view, such as separation category.

**Cross-filtering:** clicking a department bar filters the page, and the active filters show as removable chips.

**Drill-down path:** government-wide → department → agency → occupational group → series.

---

## 7. UI/UX design direction (finalised with the palette validator in Phase 4)

**Character:** a research publication that you can operate. Calm, typographic, dense where it needs to be, and never decorative.

| Element | Direction |
|---|---|
| Type | Editorial serif for headlines and narrative sentences (e.g. Source Serif 4). Neutral grotesque for UI and numbers (e.g. Inter) with **tabular numerals**. A 1.25 type scale. |
| Colour | Warm off-white paper, near-black ink, one deep accent. Separation categories get a fixed categorical order (quit, retirement, DRP, RIF, termination, other), validated for colour-blind separation. Status colours are reserved for alerts only. |
| Layout | 12-column grid, generous margins, 8px spacing scale. Thin rules instead of boxes. Small corner radii (≤ 6px). No gradients, no decorative icons. |
| Charts | Title = the question; subtitle = the answer in one sentence. Direct labels over legends where ≤ 4 series. Uncertainty always visible (bands, whiskers). Event annotations on time axes. "n" and coverage badges. A table view for every chart. |
| Interaction | Hover tooltips with value, n, CI and definition. Click to cross-filter. Brush on time charts. A 150ms ease on state changes, and nothing animated for show. |
| States | Skeletons shaped like the chart. Empty state says why (e.g. "No RIF separations in this selection"). A suppressed state says "Too few records (n < 30)". |
| Accessibility | WCAG 2.2 AA contrast, full keyboard path, focus rings, `aria` descriptions summarising each chart, `prefers-reduced-motion`. |

**Executive Intelligence wireframe:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ WORKFORCE ATLAS            Brief  Mobility  Planning  Compensation  Methods      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Sep 2025 – Sep 2026 ▾] [All departments ▾] [All occupations ▾] [All grades ▾]   │  <- global filters, URL state
├──────────────────────────────────────────────────────────────────────────────────┤
│ SEPTEMBER 2026 BRIEF                                         Data as of 2026-11-04│
│ Federal headcount was 2.02M, ▼ x.x% year on year, the largest 12-month decline   │  <- sentence from facts.json;
│ since 2012. Separations ran at …                                    [Download ↓] │     placeholders until Phase 3
├────────────────────┬────────────────────┬────────────────────┬──────────────────┤
│ Headcount          │ Separation rate    │ Accession rate     │ Replacement ratio│
│ 2,017,021          │ x.x% ann.          │ x.x% ann.          │ 0.xx             │
│ ▁▂▃▃▃▄▄▃▂▁ band    │ vs 2012–24 band    │ vs 2012–24 band    │ 12-mo rolling    │
├────────────────────┴────────────────────┴────────────────────┴──────────────────┤
│ How has the federal workforce changed since 2012?                                │
│ ─────────────────────────────────────────────────────────╮ DRP exits (Sep 2025)│  <- annotated event
│                                                           ╰──── forecast band ░░ │
├──────────────────────────────────────────┬───────────────────────────────────────┤
│ Which departments changed most?          │ What is unusual this month?           │
│ Dept A  ●────────○  −x.x%                │ ● Dept X · quits 3.1× expected   high │
│ Dept B  ●──────○    −x.x%   (click =     │ ● Dept Y · retirements 2.4×      mod  │
│ Dept C     ○──●     +x.x%    filter)     │   view all in Mobility →              │
├──────────────────────────────────────────┴───────────────────────────────────────┤
│ Source: OPM FWD, versions in manifest · Definitions · Coverage: pay 53%          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Only 2,017,021 is a measured value. The `x.x` placeholders are filled from `facts.json` in Phase 3; none is invented here.

---

## 8. Risks before implementation

| Risk | Mitigation |
|---|---|
| Browser cube too large | Size measured in Phase 3; two-level cubes; DuckDB-WASM loaded on first filter, not on page load |
| Full rebuild too slow or too large for Actions | Incremental by default; rebuild streams one file at a time; measure in Phase 3 |
| Category mappings wrong (dictionary unread) | Phase 3 blocker: read the dictionary in a browser first |
| 2025 shock breaks forecasts | Intervention term + an explicit shock fold; say so in the UI |
| Political sensitivity of the 2025 story | Neutral wording rules; counts and rates only; no attribution of motive |
| Derived pay mistaken for real pay | Distinct visual treatment (hatched) + label + methods link |
| OPM API changes or goes down | Last good published data stays live; the manifest shows the freshness date |
