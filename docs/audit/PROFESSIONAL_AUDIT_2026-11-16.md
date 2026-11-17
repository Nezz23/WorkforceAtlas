# Workforce Atlas: Professional Audit

Date: 16 November 2026. Scope: the whole repository at `~/Projects/WorkforceAtlas` and the locally served site (http://localhost:3100). Nothing was modified or deployed during the audit. The only additions are this file and the screenshots in `docs/audit/screens/`.

Method: six independent review agents. Each one had its own brief and no access to the others' findings. Each one re-ran numbers, read code and inspected the rendered pages. I then checked their key claims against the source: the OPM site, the code, and the data.

## Verdict: NO-GO for public deployment, today

The data foundation is sound and the product is well above portfolio norm. Three things would embarrass the site in front of an expert reader on day one:

1. The newest "unusual month" signals for September 2026 are mostly an OPM ingestion gap, not real workforce change. OPM's own banner says so.
2. The what-if simulator starts from a baseline that disagrees with the plotted forecast by about 84,000 people.
3. The exit-rate model's headline "1.76× expected exits" is mostly the Deferred Resignation Program (DRP) restated, and its test-year bias is unreported.

There is also no git repository, so nothing in the release path has ever run. Every blocker is fixable in days, not weeks. Section 8 lists the exact path to GO.

## 1. Scores

| Category | Score | One-line evidence |
|---|---|---|
| Data science | **6.5** | All 10 headline numbers reproduce exactly; simulator/forecast mismatch, DRP-driven excess ratio, unreported FY2024 bias |
| Data engineering | **7.0** | 534 files, 178 contiguous months per stream, rows reconcile to the cubes with 0 mismatches; CI path never run, no git |
| Software engineering | **7.5** | tsc clean, 21/21 pytest, 4/4 simulator tests, 0 npm advisories; ESLint red (2 errors), CI gates pytest only, stale PDF |
| Product design | **8.0** | Strong editorial system, 0 axe violations, focus rings, ⌘K, theme persistence; tablet nav clips, phone simulator layout, survival labels |
| Federal workforce research | **7.5** | DRP total 141,053 vs OPM 141,084; FWD coverage exclusions unstated, 2025 policy record missing, DRP note outdated |
| Hiring-manager / portfolio | **8.0** | Rare depth (backtests, intervals, calibration, simulator); not public, and the top signals are an artifact |
| **Overall (unweighted mean)** | **7.4** | Strong; not yet release-grade |

A score of 7 here means "a senior would approve it with required changes". Passing tests did not count as readiness: every test passes today, and the blockers below are all real.

## 2. Findings

Severity: **Critical** stops release. **High** must be fixed before release. **Medium** should be fixed before or soon after. **Low** is polish.

### Critical

| # | Finding | Evidence | Fix |
|---|---|---|---|
| C1 | September 2026 "highly unusual" DoD signals are an OPM ingestion artifact | OPM banner, verified 16 Nov 2026: *"Incomplete Data: A change in Department of War (DOW) data processing continues to impact some components submitting September 2026 data."* Signals rendered by `web/components/Alerts.tsx`; only a generic "first release" note exists (`Alerts.tsx:17`) | Ingest OPM's data-quality notices into the manifest; suppress or mark flagged department-months; state it on the Brief |
| C2 | No git repository, README, or public URL | `git status`: not a repository. `web/README.md` is the create-next-app text | `git init`, a real README, then deploy only after the blockers close |

### High

| # | Finding | Evidence | Fix |
|---|---|---|---|
| H1 | Simulator baseline disagrees with the forecast | Baseline flows imply +49,579 over 12 months; plotted forecast is −34,101 (`models/forecast.py:131-137` vs `:127`) | Derive simulator flows from the selected model, or anchor them so default levers equal the plotted path |
| H2 | "1.76× expected exits" is mostly DRP | Excluding DRP separations: 1.12 (FY2025), 1.05 (FY2026) | Report both ratios; lead with the non-DRP one |
| H3 | Excess-ratio interval ignores overdispersion | Pearson dispersion 7.22; CI assumes Poisson | Quasi-Poisson or bootstrap interval |
| H4 | FY2024 test bias unreported | Predicted 161,729 vs actual 138,033 (+17%); GBM deviance 1.86 → 2.45 out of sample | Publish test-year bias and deviance on the model card (`docs/05-models.md`, Methods page) |
| H5 | FWD coverage exclusions never stated | USPS, CIA, NSA, most legislative/judicial staff, non-pay-status absent ([OPM data sources](https://data.opm.gov/resources/data-sources)) | One coverage paragraph on Methods and a footnote on the Brief |
| H6 | 2025 policy record absent; DRP note outdated | Hiring freeze memo 20 Jan 2025 (FR 2025-01905); EO 14210 (FR 2025-02762); OPM probationary guidance 28 Apr 2025; Schedule Policy/Career rule (FR 2026-02375). OPM bulletin of 11 Dec 2025 authorises FY2026 agency DRP rounds, so "follow-on rounds not verified" is wrong | A dated, sourced policy timeline; correct the DRP note in `docs/reference/verification.md` and Methods |
| H7 | Warehouse and build log would be committed | `.gitignore` lacks `data/warehouse` (295 MB) and `data/build.log` | Add both before `git init` |
| H8 | Pipeline is not end-to-end and loses progress | Warehouse saved only at the end; `|| echo` swallows restore errors (`pipeline.yml:19`); no concurrency group; no Node build, PDF or deploy step | Save incrementally; fail on corrupt restore; add `concurrency:`; build and deploy in the workflow |
| H9 | Printable brief PDF goes stale or 404s | Hard-coded month link (`web/app/brief/page.tsx:20,35`); only `workforce-brief-202609.pdf` exists; never regenerated | Generate in the pipeline, or drop the month from the filename |
| H10 | CI gates only pytest; lint is red | `ci.yml` runs `pytest -q`. ESLint errors at `web/components/Header.tsx:83` and `web/components/charts/Rows.tsx:167` | Add eslint, tsc, simulator test and `next build` to CI; fix both errors |
| H11 | Tablet nav clips "Methods" | 834 px viewport — `docs/audit/screens/home-tablet-light.png`; `Header.tsx:43` | Switch to the compact nav below `lg` |
| H12 | Phone simulator: sliders ~900 px below the chart | `docs/audit/screens/planning-phone-light.png` | Sticky or adjacent chart on phones |
| H13 | Survival chart labels clip and collide | `web/components/charts/Survival.tsx:19` (120 px right margin); Mobility page | Collision-avoid labels as in `Scatter.tsx`, or a legend |

### Medium

Data science:
- Anomaly calibration effectively uses Dec 2018–Dec 2019 only; out-of-sample flag rate is about 0.7%, not the stated 1% (`models/anomaly.py`).
- WAPE is pooled across scopes. On "all departments" alone, ETS is 1.30% and stock-flow 1.07%; yearly error was 2.95% (2023) and 2.13% (2024). Report per-scope error.
- ETS training includes the DRP step-down, contrary to `docs/05-models.md`.
- Forecast scopes are chosen by latest headcount, a mild look-ahead. Choose them by headcount at each origin.
- GLM rate ratios are shown, but the chosen model is the gradient-boosted one.
- The life table uses 1 − rate instead of exp(−rate). The FY2025 figure would be 38.3% and FY2015–19 45.1%. Fix it, or state the approximation.

Data engineering:
- Manifest warnings are stale. Feb–Mar 2015 show 235 null departments with `warnings: []`.
- No completeness or contiguity check runs in the contract.
- "No Data Reported" (from Oct 2024) is published as a department scope.
- Length-of-service nulls of 10–11% raise only soft warnings.
- The manifest has no file hash and no code version.

Software engineering:
- No Open Graph tags, `metadataBase`, robots or sitemap (`web/app/layout.tsx:13-16`).
- Actions are pinned by tag, not SHA. `ci.yml` has no `permissions:` block.
- `derive.ts` and `format.ts` are untested. `last12` mishandles an unknown month (`web/lib/derive.ts:25-31`).
- `web/data` is 38 MB and committed monthly, so the repo history will bloat.

Product design:
- Chart right edges are inconsistent (`LineChart.tsx:57` vs `Columns.tsx:29`). KPI baselines and badges drift (`components/ui.tsx`).
- The lollipop chart repeats 4 times.
- Two charts say little: Compensation 01's flat lines and Mobility 01's DRP-dominated area.
- The dumbbell has no colour legend. Phone tables truncate (Planning 02). The native `<select>` is unstyled. Slider thumbs at 100% sit in inconsistent positions.

Federal research:
- Probationary terminations can't be isolated in FWD. The site should say so.
- The SJ and SE labels are not glossed.
- The revision claim rests on 3 files and doesn't cite OPM's own revision statement.
- No OPM cross-check is shown for the −258,108 change since 20 January 2025.
- Department net figures aren't comparable with the government-wide net, because transfers aren't additive. Label them.

### Low

- Scaffold leftovers: 5 unused SVGs in `web/public/`, `web/AGENTS.md`, `web/e2e/_audit_shoot.mjs`, `tsconfig.tsbuildinfo`, `data/backup/` (undocumented).
- Tap targets of 14–17 px. The header is 95% opaque. The lollipop tooltip covers labels (`docs/audit/screens/int-hover-lollipop.png`).
- The memo has no chart. The Compensation headline orphans "them.". The contents list looks detached.
- The brief's "tested on years not seen" overclaims the backtest. "What would change it" leans causal, and "The 2025 shock" is editorial.
- `pipeline/web.py` `dump(default=str)` hides type errors. No idempotency test exists. A failed run opens a new issue every time, with no dedupe.

## 3. Verified accomplishments

Each item below was re-checked by at least one reviewer against data or code, not taken from docs.

- **Real federal data end to end:** 534 OPM Federal Workforce Data files, December 2011 to September 2026, 178 contiguous months per stream. Source row counts equal cube sums for every file, and versions match OPM's live catalogue.
- **Versioned, contract-gated ingest:** a re-published month is rebuilt, and a structural break stops the run. The revision impact is measured: September 2025 separations went from 125,589 (v1) to 120,540 (v5).
- **Reproducible headline numbers:** all 10 Brief headline figures reproduced exactly from the warehouse. The DRP total of 141,053 sits within 0.02% of OPM's 141,084.
- **Forecasting with honest evaluation:** 4 candidate models were tested with a rolling-origin backtest over 44 origins, beaten-baseline selection and empirical prediction intervals.
- **Anomaly detection:** 146 series, scored with a robust seasonal z-score and a calibrated threshold.
- **Retention:** period life tables with bootstrap intervals.
- **Explainable exit-rate model:** a Poisson GLM against gradient boosting, with a time-ordered train/validate/test split.
- **What-if simulator:** pure TypeScript, unit-tested, with exact reproduction at default levers. That holds for its own baseline; see H1.
- **Derived GS pay:** fills redacted pay where the grade allows, raising coverage from 57.5% to 99.8%. It is labelled as derived throughout.
- **Static Next.js 16 site:** 132 prerendered pages, custom D3/SVG charts, light and dark themes, observed/derived/modeled trust marks, 0 axe violations in both themes, 15/15 interaction checks, and a printable brief with no LLM-written text.
- **Hygiene:** 0 npm advisories, no secrets in the tree, no runtime third-party requests.

## 4. Competitive position (verified)

| Product | What it does well | What Workforce Atlas adds | Where Atlas is behind |
|---|---|---|---|
| [OPM Workforce Data / Table Builder](https://data.opm.gov) | Official source; subagency and occupation drill-down; downloads, API, FWD Chat; data-quality banners | Forecasts with intervals, anomaly signals, retention curves, exit model, simulator, a narrative brief | Depth of drill-down, custom queries, and **data-quality banners**: OPM is ahead on the very issue behind C1 |
| Partnership for Public Service ([Federal Harms Tracker](https://federalharmstracker.org)) | Policy and service-impact reporting | Quantitative modelling on the full monthly record | Policy context (see H6) |
| Pew Research (13 Mar 2026 analysis) | Trusted headline numbers: −10.3%, 116,912 hires, 348,219 separations | Monthly refresh, department profiles, model-based expectations | Editorial authority |
| Revelio Labs (RPLS) | Private-sector labour statistics from online profiles | Official administrative data, not scraped | Breadth beyond government |

**Positioning check:** "an independent intelligence platform for the American federal workforce" is defensible once C1 and H5–H6 are fixed. Until then, an expert would say it misreads OPM's own data-quality notice.

## 5. Ranked improvements

Ranked by impact over effort. S = under half a day, M = 1–2 days, L = 3 or more days.

| Rank | Change | Closes | Impact | Effort |
|---|---|---|---|---|
| 1 | Add `data/warehouse`, `build.log` to `.gitignore`; `git init`; real README | C2, H7 | High | S |
| 2 | Mark or suppress signals for department-months under an OPM data-quality notice | C1 | High | S–M |
| 3 | Align simulator baseline with the selected forecast | H1 | High | S |
| 4 | Report non-DRP excess ratio, dispersion-corrected CI, FY2024 test bias | H2–H4 | High | S |
| 5 | Coverage paragraph and dated 2025 policy timeline; correct DRP note | H5, H6 | High | S–M |
| 6 | Fix 2 ESLint errors; CI runs eslint, tsc, simulator test, `next build` | H10 | Medium | S |
| 7 | Monthless PDF filename or pipeline-generated PDF | H9 | Medium | S |
| 8 | Tablet nav breakpoint; survival labels; phone simulator layout | H11–H13 | Medium | M |
| 9 | Harden pipeline workflow: incremental save, strict restore, concurrency, build + deploy | H8 | Medium | M |
| 10 | Model-card corrections: per-scope WAPE, calibration window, exp(−rate), GBM attributions | Medium DS items | Medium | M |
| 11 | OG/meta/sitemap; manifest hash and code version; completeness check | Medium SE/DE items | Low–Medium | S–M |
| 12 | Visual polish and scaffold cleanup | Low items | Low | S |

Ranks 1–7 are about two working days and clear every Critical and the highest-risk Highs.

## 6. Production-readiness assessment

| Area | Status | Notes |
|---|---|---|
| Correctness of observed data | Ready | Reconciles to OPM file-by-file |
| Correctness of modelled claims | **Not ready** | H1–H4 |
| Interpretation and context | **Not ready** | C1, H5, H6 |
| Release automation | **Not ready** | Never run (no repo); H8–H10 |
| Security | Ready | Static site, no secrets, no runtime third-party calls; CSP would need a hash for the theme script |
| Performance | Ready, with notes | Largest JS chunk 229 KB; ~316 KB per page; repo growth from monthly JSON |
| Accessibility | Ready, with notes | 0 axe violations; small tap targets (Low) |
| Responsive layout | **Not ready** | H11, H12 |
| Documentation | Partly | Strong methods docs; no README; scaffold README misleads |

## 7. Pre-deployment checklist

Security
- [x] No secrets in tree (grep for key/secret/token/password/AKIA/sk-)
- [x] `npm audit`: 0 vulnerabilities
- [x] Only `dangerouslySetInnerHTML` is a constant theme script
- [ ] Pin Actions by SHA; add `permissions:` to `ci.yml`
- [ ] Python advisory scan (`pip-audit`), not yet run

Data accuracy
- [x] 534 files reconcile; versions match OPM catalogue
- [x] 10 headline numbers reproduced
- [ ] OPM data-quality notices reflected in signals (C1)
- [ ] Simulator baseline equals forecast (H1)
- [ ] Non-DRP excess ratio and test bias published (H2–H4)
- [ ] Coverage exclusions and policy timeline stated (H5, H6)

Performance
- [x] Static export, no runtime API calls
- [x] Largest chunk 229 KB
- [ ] Decide whether monthly `web/data` commits are acceptable, or move data to release assets

Documentation
- [x] `docs/05-models.md`, `docs/reference/verification.md`, `PROJECT_STATUS.md`
- [ ] Root README with live link, screenshots, method summary, data terms
- [ ] Replace `web/README.md`; document `data/backup/` or remove it
- [ ] Correct model-card items (Medium DS list)

Repository cleanliness
- [ ] `.gitignore`: `data/warehouse/`, `data/build.log`, `tsconfig.tsbuildinfo`
- [ ] Remove scaffold SVGs, `web/AGENTS.md`, `web/e2e/_audit_shoot.mjs`
- [ ] ESLint clean; CI gates web build
- [ ] Commits authored as Nezz23 noreply, with no AI co-author line

## 8. Path to GO

Move to GO when C1, C2 and H1–H10 are closed and the checklist above has no open Data accuracy or Repository items. H11–H13 are layout faults a visitor sees in seconds, so fix them in the same pass. The Medium items can follow in the first month.

## 9. Resume bullets (evidence-backed)

Use only after the blockers are fixed, since a reviewer may open the live site. Every figure below traces to Section 3.

- Built Workforce Atlas, an independent analytics platform on 15 years of OPM federal workforce data (534 versioned files, Dec 2011–Sep 2026), with a contract-gated DuckDB pipeline that reconciles every source file to its published cubes.
- Forecast department headcount with 4 candidate models selected by a 44-origin rolling backtest, publishing empirical prediction intervals instead of point estimates.
- Detected unusual hiring and exit months across 146 series with a seasonal robust z-score, calibrated to a target false-alarm rate.
- Modelled exit rates with a Poisson GLM and gradient boosting on a time-ordered train/validate/test split, separating the Deferred Resignation Program's effect from other exits.
- Derived General Schedule pay where OPM redacts it, raising pay coverage from 57.5% to 99.8%, with every derived value labelled.
- Shipped a 132-page static Next.js site with custom D3 charts, a tested what-if simulator and a printable monthly brief; 0 axe accessibility violations in light and dark themes.

Bullet 4's "separating the DRP's effect" is true only after H2 is done. Drop or reword it until then.

## Appendix: evidence

- Full reviewer reports (six): session scratchpad `audit/1_data_science.md` … `6_hiring_and_competition.md`. Summarised above, not copied.
- Screenshots in `docs/audit/screens/`: each page at desktop width (`*-desktop-light.png`), `home-tablet-light.png` (H11), `planning-phone-light.png` (H12), and interaction captures (`int-*.png`: tooltip, scenario, focus ring, ⌘K, lollipop overlap).
