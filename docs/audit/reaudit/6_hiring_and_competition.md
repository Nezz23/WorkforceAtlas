# Re-audit 6: Hiring manager and competition (2026-11-17)

Score: 8.6 / 10 (was 8.0). Judged as an artifact; the owner has not pushed or deployed.

## 1. First-audit findings
| Finding | Status | Evidence |
|---|---|---|
| C1 DoD Sept signals are an OPM artifact | Resolved | Brief now opens with a Data notice block (4 notices, linked to OPM releases 1.17.0 / 1.14.0). DoD September items render as "Reporting gap, records missing". Forecast origin moved to Aug 2026. docs/05-models.md s0. Live OPM banner re-verified today and matches. |
| C1 residue | Partly | Two non-DoD "unusual" signals still shown from "first release" data (GSA retirements 0 vs 21; NASA hires 1,493 vs 80, 18.4x). They may be real, or first-release noise. A skeptic will ask. |
| C2 No repo, README, public URL | Partly | Real README (architecture, observed/derived/modeled, limits), REPRODUCING.md, CI workflows. Repo has `git init` but "No commits yet"; no LICENSE ("not yet chosen"); `web/README.md` is a pointer, fine. No public URL. |
| Cost of not deployed | Open, by design | A recruiter cannot click anything. Without a commit history and a live link, none of the work counts for a resume. This is the main distance between 8.6 and 9+. |
| Competitive table | Partly | See s2. |
| Resume bullet 4 (DRP separation) | Resolved | Excess ratio with and without DRP is now modeled, with the caveat that neither is causal (05-models s5). |
| Brief "tested on years not seen" overclaim | Resolved | Brief says ranges "held 49% of outcomes in 2023-2024 and 18% in 2025-2026, short of 80%". Unusually candid. |
| Methods rigor (H1 simulator = forecast, validation, exit bias) | Resolved | Simulator flows reconcile: 220,143 - 201,162 - 17,881 = +1,099 (forecast.json). Exit-model per-year bias published (-17.5% to +16.3%). |

## 2. Competitive comparison (live sources, 17 Nov 2026)
1. OPM data.opm.gov: scraped live. Confirms Table Builder (Employment, Accessions, Separations, CSV export), FWD Chat (BETA, LLM), Data Downloads, Bulk API, Workforce Changes insight page, and the "Incomplete Data: DOW" banner. Claim holds. Atlas now matches OPM on the banner issue (notices page-wide + per-department gaps) and exceeds it on modeling. OPM still leads on custom queries, occupation/location filters, authority, and ownership of the source.
2. Pew (13 Mar 2026): confirmed "shrank 10.3% in 2025", ~238,000 net, 116,912 hires, 348,219 separations, 80.8% increase. Claim holds. Pew is calendar 2025 and excludes transfers; Atlas government-wide flows also exclude transfers (D-9), so the numbers are comparable. Add this as a cross-check in Methods if not there. Pew leads in editorial authority; Atlas leads on monthly refresh, departments, forecast with calibration.
3. Partnership for Public Service Federal Harms Tracker: confirmed to exist (federalharmstracker.org). Search snippet says "federal workforce shrank by 264,000 over two years" and it tracks funding and programs too. The first audit's "policy and service-impact reporting" description holds. Atlas has the policy timeline now (context.md), but PPS covers funding and programs, which Atlas does not.
Net: Atlas leads on uncertainty quantification, anomaly gaps, and the reproducible pipeline. It trails on drill-down depth, authority, and reach. "Intelligence platform" is still large for what is a 6-page analysis site; "independent analysis" is more defensible.

## 3. Showcase readiness
- 60-second impression (home screenshot): strong. Headline, data-notice box, KPIs, forecast fan chart, September 2025 DRP chart. Editorial, calm, honest. The notice box at the top is a trust signal that a senior reviewer will notice.
- README: good; concise, architecture diagram, limits. Missing: a live link, a "key findings" or "what I learned" paragraph, a results table of backtest errors, license. Images point to docs/audit/screens (fine).
- Attack surface:
  - Interval coverage is poor (80% nominal gives 49%/63% in test and 18%/33% in 2025-26) even after being disclosed. Disclosed is good; unfixed is still a weakness. Conformal calibration would be the stock answer.
  - Government-wide chosen stock-flow wins on 2025-26 only 5.96 vs 7.02 for naive; the "recovery of 1.1K" headline is inside noise. The brief headline treating it as a "partial recovery" overreads a point estimate.
  - Exit model: GBM is chosen on deviance but level bias reaches 17.5% per year; deviance gain of 87% is vs a weak baseline (department average).
  - Selection by 12-month WAPE on a window where the regime then changed. Fine, but shows no regime-change handling.
  - Ex post "suspected" gap for August DoD is a human judgment (reviewed CSV).
  - Anomaly: 1.01% calm flag on calibration is tautological; 0.69% holdout is the real number.
  - No git history, no release, data not downloadable ("exit 3 means no release exists yet"). Reproduction currently takes hours.
- 8 interview questions:
  1. Your 80% intervals cover 18% in 2025-26. Why not conformal or regime-aware intervals?
  2. How did you decide the August DoD separations were a gap and not a real fall? What if you were wrong?
  3. Why stock-flow for government-wide but ETS for departments?
  4. The exit model's yearly bias reaches 17.5%. What would you use to fix it and what would you say to a user relying on it?
  5. Can you claim causal effect of DRP? What is the ratio actually measuring?
  6. What happens when OPM revises a month? Show the contract that stops a build.
  7. How do you reconcile your numbers with Pew's 348,219 separations?
  8. What would change for a person-level exit model, given no person ID?

## 4. Resume bullets (every number cited)
- Built Workforce Atlas, a static analytics site on OPM Federal Workforce Data: 178 contiguous months (Dec 2011 to Sep 2026) across employment, accessions and separations (data/published/manifest.json: 178 per stream; months range).
- Forecast federal headcount for government-wide and departments with 4 candidate methods (naive, drift, ETS, stock-flow) over 44 quarterly rolling origins; chose per level on pre-2023 targets, tested on 2023-24, and reported 2025-26 separately (data/published/models/forecast.json: n_origins 44, methods, windows).
- Measured and disclosed forecast-interval failure: 80% ranges covered 49.4% (government) and 63.3% (departments) of 2023-24 outcomes and 18.1% / 33.1% in 2025-26, then widened them with the 2025-26 errors (forecast.json interval_coverage_80).
- Built a Poisson GLM and gradient-boosting exit model with rolling-origin validation FY2019-24; the chosen GBM cut test deviance 87.2% vs a department-average baseline (2.07 vs 16.17) (exit_model.json gain_vs_baseline_test_pct, deviance.test_mean); reported yearly total-level bias of up to 17.5% (docs/05-models.md s5).
- Calibrated an anomaly detector (threshold 4.73) on 2017-19 to flag 1.01% of 3,962 months, then held out 2022-24 at 0.69% of 3,790 (anomaly.json), and routed OPM-reported incomplete department-months to "reporting gaps" instead of signals (docs/05-models.md s0).
- Derived GS base pay where redacted, lifting GS-record pay coverage from 57.5% to 99.8% for Sep 2026 (data/published/facts.json: gs_coverage_observed_pct_latest, gs_coverage_with_derived_pct_latest).
Dropped from the prior list: "534 files" and "132 pages", "0 axe violations" and "15/15 checks" (not in the JSON, the manifest, or the docs I was given; re-verify from build and e2e output before using; 3x178=534 does match the manifest). "146 series" is stale: anomaly.json says 149.

## 5. Score and remaining findings: 8.6 / 10
Medium (3)
- M1 Not published: no commit, no URL, no LICENSE; data not downloadable. Costs the whole payoff.
- M2 Interval coverage still far below nominal (49/63/18/33%); no conformal fix.
- M3 Two non-DoD "first release" signals (GSA, NASA) shown as unusual without a first-release caveat on the signal itself; also the "partial recovery 1.1K" headline overreads noise.
Low (4)
- L1 README lacks a key-findings and a backtest-results section.
- L2 "intelligence platform" tagline overclaims for scope.
- L3 Pew cross-check (348,219 vs Atlas) not shown on the site.
- L4 PROFESSIONAL_AUDIT.md still lists stale counts (146 series) and an out-of-date resume list.
Critical 0, High 0.

Summary
- Score 8.6/10
- Critical 0, High 0, Medium 3, Low 4
- Top 3: (1) not committed/deployed/licensed; (2) intervals badly under-cover despite disclosure; (3) first-release GSA/NASA signals and "partial recovery 1.1K" headline overread noise.
