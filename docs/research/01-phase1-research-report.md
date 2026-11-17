# PeoplePlus: Phase 1 Research Report

- **Date:** 2026-11-15
- **Status:** draft for decision. No code written.

**Labels used throughout this report:**

| Label | Meaning |
|---|---|
| **VERIFIED** | Checked at the source today |
| **THIRD-PARTY** | From a review site, article or search summary; not checked at source |
| **UNVERIFIED** | Assumption to confirm |
| **RECOMMENDATION** | My judgment |

---

## 1. Verdict and the assumptions I'm challenging

**Build PeoplePlus on the US federal workforce, using OPM's person-level public data. Do not build it on a Kaggle HR file.** It is the only free source I found that is real, at employee-record grain, monthly, and runs from 2005 to September 2026. It covers about a third of what the brief asks for at full quality. So build that third exceptionally well, and cut most of the rest.

| # | Your assumption | Challenge | Recommendation |
|---|---|---|---|
| 1 | Seven modules | Real data supports only about three of them well. Recruitment funnel, cost per hire, individual performance and individual engagement have **no real public source**, so they would be synthetic. Seven modules with four synthetic ones looks exactly like the generic dashboard you want to avoid. | **3 core modules + 1 stretch** (§6). |
| 2 | A new project | **PeoplePulse** (your repo) already does individual attrition ML on fictional IBM data. A second HR project on similar data reads as repetition. | PeoplePlus must be the **real-data, workforce-planning** project. Reference PeoplePulse for individual-level modeling instead of repeating it. |
| 3 | Explainable ML attrition predictions | OPM files have **no person identifier** (VERIFIED, §3.1). You cannot follow one employee month to month, so individual risk scores are impossible. That suits your ethics rule. | Model **separation rates by workforce segment** (agency × occupation × grade × tenure × age band). Explain the segment drivers with GLM coefficients or SHAP on segment features. |
| 4 | Pay equity analysis | The person-level files have **no sex or race fields** (VERIFIED in the separations schema). Pay is **redacted for 29.4%** of separation records, concentrated in security agencies. | Drop protected-class pay equity, or use OPM's aggregated demographics only if that data is verified. Keep **pay structure** (grade, step, locality) and **redaction-aware** pay analysis. |
| 5 | Next.js + FastAPI + Postgres + Vercel + a backend host | That's two deploys, a cold-starting free backend, and a database to keep alive, for data that changes **once a month**. | **Monthly batch pipeline** (Python + DuckDB in GitHub Actions) → Parquet/JSON aggregates → **Next.js on Vercel** reading them. No FastAPI, no Postgres (§5). |
| 6 | AI summaries + natural-language queries | Free-text questions over workforce data invite wrong numbers, which breaks your "no fabricated metrics" rule. OPM already runs its own chat on data.opm.gov. | Summaries are **generated from computed facts** (templates; an LLM may only rephrase, and numbers are checked against the facts). **Defer NL query**. |
| 7 | Name "PeoplePlus" | One letter from your own "PeoplePulse", so recruiters will confuse them. Other businesses may already use the name (UNVERIFIED). | Rename before Phase 4. Run `f01-naming` when you get there. |

**The story this enables (real and current):** what happened to the US federal workforce in 2025–26. The data includes a deferred-resignation indicator (`drp_indicator`), RIF separations and retirement categories (all VERIFIED as fields). Present it **neutrally**: rates, composition and exposure, with no political framing.

---

## 2. Competitor analysis

All of this is THIRD-PARTY (vendor and review-site summaries). Confirm on vendor sites before quoting.

| Product | Core idea | Borrow | Don't copy |
|---|---|---|---|
| **Visier** | Standalone people-analytics layer over HRIS data. Question-led navigation, benchmarks, planning, an AI assistant ("Vee"). | Navigation by business question rather than by chart; benchmarks next to every metric. | Hundreds of prebuilt metrics. |
| **Workday People Analytics / Prism** | Analytics embedded in the HCM system of record. | Metric definitions tied to the source of truth. | Admin-heavy configuration. |
| **Microsoft Viva Insights** | Collaboration signals (meetings, email) aggregated for wellbeing and productivity, with group-size privacy thresholds (UNVERIFIED detail). | **Minimum group size** before showing any segment. PeoplePlus should suppress cells under n = 10. | Activity surveillance. |
| **Eightfold AI** | Skills intelligence, matching, internal mobility. | Nothing for this scope. | Individual-level AI judgments. |

**Where PeoplePlus differentiates:** these products sell breadth over private data. A portfolio piece can't win on breadth. It wins on **methodological transparency**:

- every metric shows its definition, coverage and uncertainty
- forecasts show backtest error against a naive baseline
- redaction and small-cell suppression are visible, not hidden

The RetailPulse discipline carries straight over.

Sources: [TrustRadius Visier vs Workday Prism](https://www.trustradius.com/compare-products/visier-vs-workday-prism-analytics) · [rfp.wiki Eightfold vs Visier](https://www.rfp.wiki/vendors/eightfold-ai/visier) · [Viasocket HR analytics roundup](https://viasocket.com/discovery/blog/6sdx16/7-hr-analytics-platforms-for-smarter-workforce-planning). Accessed 2026-11-15.

---

## 3. Datasets

### 3.1 OPM Federal Workforce Data (FWD): **primary, VERIFIED**

| Item | Finding | Status |
|---|---|---|
| What | Replaced FedScope in January 2026. Monthly **Employment** (snapshot), **Accessions** (hires/transfers in) and **Separations** files from EHRI. | VERIFIED: [OPM release](https://www.opm.gov/news/news-releases/opm-launches-new-workforce-data-site/) |
| History | Files listed from **2005-01 to 2026-09**. September 2026 was published 2026-11-04. | VERIFIED: API list call and [downloads page](https://data.opm.gov/get-data/data-downloads) |
| Access | Open REST API, **no authentication**: `https://data.opm.gov/api/v1/files/{employment\|accessions\|separations}`. Files are Parquet. | VERIFIED: [API page](https://data.opm.gov/get-data/api-access), live call |
| Size per month | Employment 26–75 MiB; separations 0.1–4 MiB; accessions 0.06–1 MiB | VERIFIED (API page). Full history ≈ 10+ GB, so aggregate in the pipeline and never ship raw files. |
| Grain | One row per personnel record (`count` = 1 for all 14,350 rows of Sep 2026 separations). **No person ID.** | VERIFIED (file inspected) |
| Fields (69) | Agency/sub-element, occupation series/group, grade, step, pay plan, annualized pay, length of service, age bracket, education, supervisory status, appointment type, tenure, work schedule, veteran indicator, STEM flag, duty station, `separation_category`, `drp_indicator`, effective month | VERIFIED |
| Separation types (Sep 2026) | Quit 5,784 · voluntary retirement 3,740 · termination/expired appointment 1,864 · individual transfer out 1,092 · other 1,021 · early-out retirement 497 · other retirement 259 · RIF 76 | VERIFIED |
| Redaction (Sep 2026 separations) | Pay 29.4% redacted · duty state 26.8% · age 0% · service 0.4%. Pay redaction is concentrated in DHS, Navy, DOJ and DoD. | VERIFIED. Redaction is **not random**, so pay results are biased unless every chart shows its coverage. |
| Not present | Sex, race/ethnicity, performance rating, person ID | VERIFIED (absent from schema). OPM says performance-rating **distributions** are published separately (THIRD-PARTY via OPM news; not inspected). |
| Licence | US federal government work, generally public domain | UNVERIFIED for this site. Check the [data release policy](https://www.opm.gov/policy-data-oversight/data-analysis-documentation/data-policy-guidance/data-standards/data-release-policy-december-2024.pdf). |
| Data dictionary | [FWD Data Dictionary.xlsx](https://data.opm.gov/get-data/FWD%20Data%20Dictionary.xlsx) | Download returned a non-xlsx response. **Retry manually.** |

### 3.2 Supporting sources

| Source | Use | Grain | Status |
|---|---|---|---|
| [OPM FEVS public data file](https://www.opm.gov/fevs/public-data-file/) | Engagement and satisfaction by agency and year; joins to FWD at **agency × year** only | Respondent-level, de-identified (THIRD-PARTY) | Page returned 403 to a script; check in a browser |
| [BLS JOLTS API](https://api.bls.gov/publicAPI/v2/timeseries/data/JTS000000000000000QUR) | Private-sector and state/local quit, hire and separation rates as a benchmark | National/industry, monthly | API reachable (200); series content not inspected |
| BLS OEWS | Occupation wage benchmarks | Occupation × area | Not checked. Needs an OPM-series-to-SOC crosswalk, **UNVERIFIED** that one exists |
| IBM HR attrition sample | — | Fictional | **Do not use.** PeoplePulse already covers it. |

---

## 4. KPIs (definitions to lock in Phase 3)

| KPI | Definition | Real data? |
|---|---|---|
| Headcount | Records in the month's Employment file (on-board count) | ✓ |
| Net change | Headcount(t) − Headcount(t−1); reconcile with accessions − separations, and report the gap | ✓ |
| Separation rate (monthly, annualized) | Separations ÷ average headcount | ✓ |
| Quit rate / retirement rate / involuntary rate | By `separation_category`, on the same denominator | ✓ |
| Accession (hire) rate | Accessions ÷ average headcount | ✓ |
| Early-tenure attrition | Share of separations with < 1 and < 2 years of service | ✓ |
| Retirement exposure | Share of headcount at or near eligibility, using age bracket + service years as a proxy | ✓ (proxy, labelled) |
| Pay distribution / payroll run-rate | Sum and quantiles of annualized pay **on unredacted records**, with coverage % | Partial |
| Engagement index | FEVS EEI by agency × year | ✓ aggregate only |
| Time to hire, cost per hire, funnel conversion | — | ✗ none |
| Individual performance | — | ✗ (distributions only, maybe) |

**Rule:** any segment under 10 people is suppressed. Every rate shows its denominator.

---

## 5. Proposed architecture (RECOMMENDATION)

```
 data.opm.gov API ──┐
 BLS JOLTS API ─────┼─> GitHub Actions (monthly cron)
 FEVS files ────────┘     Python + DuckDB
                          ├─ download → validate (schema, row counts, redaction %) → fail loudly
                          ├─ aggregate to segment × month cubes (n ≥ 10)
                          ├─ models: forecasts + backtests, segment separation-rate GLM/GBM + SHAP
                          ├─ facts.json (every number a summary may cite)
                          └─ commit Parquet/JSON to /data   <- reproducible, versioned, small
                                       │
                          Next.js (TypeScript, Tailwind) on Vercel
                          ├─ static/ISR pages read /data
                          ├─ DuckDB-WASM for cross-filter/drill-down in the browser   <- no backend needed
                          └─ ECharts (cross-filter, large series, a11y aria)
```

| Proposed tool | Verdict | Why |
|---|---|---|
| Next.js + TypeScript + Tailwind | Keep | Shows product-engineering range; Vercel free tier |
| Recharts / ECharts / Plotly | **ECharts** | Built-in brush/dataZoom for cross-filtering and drill-down; handles 250 months × many series |
| FastAPI | **Cut** | No server work that the batch job + DuckDB-WASM can't do. Add a single Vercel function only if an LLM call is needed. |
| PostgreSQL | **Cut** | Monthly read-only data; Parquet in the repo is simpler and reproducible |
| Pandas + DuckDB + SQL | Keep, DuckDB first | Reads Parquet straight from the API; documented SQL is a portfolio deliverable |
| scikit-learn, XGBoost, SHAP | Keep (scikit-learn + SHAP); XGBoost only if it beats GLM on the backtest | |
| statsmodels | **Add** | Forecasting (ETS/SARIMAX) and GLM with confidence intervals |
| GitHub Actions | Keep | Monthly refresh + CI tests |

Free-tier risk: Vercel only; nothing else needs to stay awake.

---

## 6. Feature feasibility

| Module (your brief) | Feasibility | Decision |
|---|---|---|
| **Executive overview**: headcount, turnover, growth, department breakdowns, trends, alerts | Real, high | **Core** |
| **Attrition & retention**: trends, drivers, segment risk, scenario analysis, model limits | Real, high (segment level) | **Core** |
| **Workforce planning**: headcount forecast, attrition/hiring scenarios, cost projections | Real, high (cost uses pay coverage caveat) | **Core** |
| **Compensation**: distribution, grade/step structure, payroll trend, anomalies | Partial (29% pay redaction; no sex/race) | **Stretch**: pay structure + redaction-aware trends. Equity dropped. |
| Performance & engagement | FEVS by agency only; no individual performance | Fold engagement into overview as an agency-level overlay (later) |
| Talent & recruitment | Hiring volume and type: real (accessions). Funnel, time and cost per hire: none. | Hiring trends go inside Workforce planning. **Drop funnel**, and never build it synthetic in this product. |
| AI executive intelligence | Template summaries from facts: high. NL query: risky. | Monthly briefing generated from `facts.json` + downloadable PDF. **No NL query in v1.** |

---

## 7. Prioritized roadmap

| Phase | Output | Gate |
|---|---|---|
| 2 Requirements | 10–12 business questions (e.g. "Which agencies lost the most early-tenure staff since Jan 2025, and is that above their 2015–24 range?"), each mapped to a chart | You approve the question list |
| 3 Data & KPIs | Pipeline for FY2015→latest; validation report; data dictionary; KPI SQL | Reconciliation: headcount change vs accessions − separations, gap explained |
| 4 Brand & UX | Name, palette (validated for colour-blindness), wireframes of 3 core pages | You approve wireframes |
| 5 EDA | Notebook + findings with CIs; 2025–26 shift quantified against history | Every claim reproducible from SQL |
| 6 Dashboard | Overview, Attrition, Planning; cross-filter; tooltips; loading/empty states | Lighthouse a11y ≥ 95; mobile works |
| 7 Models | Forecast backtest vs seasonal-naive; segment separation-rate model vs base-rate baseline; SHAP; fairness note (age bands) | Beats baseline or says so |
| 8 Testing | Pipeline tests, KPI fixtures, UI smoke tests | CI green |
| 9 Deploy & docs | Vercel, README, architecture, model report, case study, executive PDF, verified resume bullets | Live URL checked |

Compensation (stretch) slots in after phase 7 only if the core is finished.

---

## 8. Decisions needed from you

1. **Accept the federal-workforce focus?** This decides everything else.
2. **Cut to 3 core modules + compensation stretch, and drop the recruitment funnel?**
3. **Cut FastAPI and Postgres** in favour of a batch pipeline plus a static app?
4. **Rename** away from "PeoplePlus"?
5. **History window:** FY2015→present (recommended; about 140 monthly employment files) or all of 2005→?
