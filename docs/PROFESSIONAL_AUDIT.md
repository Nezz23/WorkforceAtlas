# Workforce Atlas: Professional Audit (second re-audit)

Date: 17 November 2026. Branch `remediation`; nothing committed, pushed or deployed. Earlier reports:
`docs/audit/PROFESSIONAL_AUDIT_2026-11-16.md` (first audit, NO-GO, mean 7.4) and
`docs/audit/PROFESSIONAL_AUDIT_2026-11-17_first-reaudit.md` (mean 8.1). The six reviewers' full reports, with the
evidence for every finding, are in `docs/audit/reaudit2/`.

Owner decisions in force: private source repository, public website on Cloudflare Pages, no open-source license.

Method: six new review agents, none of which built the changes, re-checked the work with their own commands, source
checks and screenshots. Their high findings were then fixed and re-verified by the lead (section 3). Scores are the
reviewers' own, given before those fixes, and are not raised here without a new review.

## Verdict

**Ready to deploy as a public demo once the owner completes the setup in `docs/DEPLOYMENT.md`.** No critical finding
in any category; every high finding that code can fix has been fixed and re-verified. Two highs need the owner, not
code: the work cannot be verified by an outsider while the repository is private and CI has never run, and the site
names no author.

## 1. Scores

| Category | First audit | First re-audit | Second re-audit | Main evidence |
|---|---|---|---|---|
| Data science | 6.5 | 7.5 | **8.0** | no leakage found; models reproduce byte for byte; docs had drifted (fixed) |
| Data engineering | 7.0 | 7.5 | **7.5** | fallbacks did nothing on a fresh runner (fixed); never run in CI |
| Software engineering and security | 7.5 | 8.0 | **8.4** | no high findings; nothing private exposed; localhost fallback, unlocked wrangler (fixed) |
| Product design | 8.0 | 8.6 | **8.7** | 0 overflow, 0 axe violations; range bands illegible, false precision (fixed) |
| Federal workforce research | 7.5 | 8.3 | **8.4** | all policy facts and JOLTS values re-verified at source; ratios over-precise (fixed) |
| Hiring manager / portfolio | 8.0 | 8.6 | **8.4** | strong site; private repo makes claims unverifiable; no author on site |
| **Mean** | **7.4** | **8.1** | **8.2** | 0 critical findings |

The hiring-manager score fell because the earlier score assumed a public repository, not because the work got worse.

## 2. Model changes in this round

| Change | Validation | Result |
|---|---|---|
| Forecast ranges: adaptive conformal inference instead of fixed quantiles | 80% interval score on targets up to 2022 (tie: 3.33 vs 3.34, 25.6 vs 25.5); adopted on design grounds, disclosed | Test-year hit rate of 80% ranges: departments 63% → 73%, government-wide 49% → 53%; 2025–26: 33% → 47% and 18% → 23% |
| Exit model: yearly level from the BLS private-sector quit rate | Rolling origin, chosen on FY2019–22 (deviance 2.52 → 2.36); test FY2023–24 2.07 → 2.02 | Mean absolute yearly bias 9.7% → 6.0% (selection), 10.0% → 9.9% (test); worst 17.5% → 13.6%; disclosed that the idea came from looking at all six years |
| Exit model: final refit years | Bug: read FY2013–2024, documented FY2015–2024 | Fixed |
| Quit-rate coefficient uncertainty | Clustered by fiscal year (SE 0.004 → 0.066), added to the ratio intervals | FY2025: 1.92 (1.43–2.58), 1.21 without deferred resignations (0.90–1.63); without the quit-rate term 1.77 and 1.12, shown on the site |

## 3. High findings of this re-audit and their fixes

| Reviewer | Finding | Status |
|---|---|---|
| Data science | `docs/05-models.md` figures drifted from the JSON | Fixed: refreshed, and `tests/test_docs.py` now fails if quoted figures drift |
| Data science | Today's 80% and 95% ranges identical (both at the 1% floor); "guarantee" overclaimed | Fixed: bounds are multiples of each target, so the 80% range stays inside the 95%; wording says "aim", not guarantee |
| Data engineering | Keep-last-file fallbacks useless on a fresh runner | Fixed: the workflow restores the last published data first; failed or malformed BLS responses keep the file; atomic write; 2 tests |
| Data engineering | Pipeline never run end to end | Owner: first run of the workflow |
| Product design | 80% and 95% bands indistinguishable, jagged start, no legend | Fixed: 80% filled, 95% outlined, both in the legend, fan starts at the last observed month |
| Product design | False precision (2,024,696 beside a ±10% range) | Fixed: forecasts shown as 2.02M with the 80% range under each figure |
| Federal research | 1.92× and 1.65× over-precise; no sensitivity shown | Fixed: clustered SE in the intervals; ratios without the quit-rate term on Mobility and Methods; framed as a proxy, with why the federal JOLTS series was not used |
| Hiring manager | "80%" ranges labelled without their real hit rate | Fixed: every first mention says how often such ranges held in testing |
| Hiring manager | Stale resume numbers | Fixed: section 6 |
| Hiring manager | Work unverifiable with a private repository | Owner: see section 5 |
| Hiring manager | No author, contact or provenance on the site | Owner: needs the name and profile link to show |

Mediums fixed in the same pass: notice record counts now belong to the files their sentence names (Status vs
Dynamics), Defense naming explained ("DOW" in OPM's notes), deferred-resignation counts reconciled on Mobility,
`npm audit --omit=dev` in CI, wrangler installed from the lockfile with the project name passed through the
environment, and `check_public.sh` fails a deploy whose build still points at a local address.

## 4. Verification run (after all fixes)

| Check | Result |
|---|---|
| Python tests | 63 passed (includes 12 docs-drift checks) |
| Web unit tests (`node --test`) | 18 passed |
| ESLint / TypeScript | 0 / 0 |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | 134 static pages |
| `npm run pdf` | built |
| Browser checks (`npm run test:e2e`) under the production security headers | 15 of 15 pass |
| Accessibility (axe, WCAG 2.2 AA) | 0 violations, 7 pages × light and dark |
| `scripts/check_public.sh web/out` | 813 files, nothing private |
| gitleaks on the 196 files that would be committed | no leaks |
| actionlint | clean |

## 5. What still stands between this and 9+

- **Verifiability (owner).** With the repository private, a reviewer must trust the claims. Options: one green CI
  run before claiming CI; a read-only invite for interviewers; a walkthrough of `models/` and the backtests in
  interviews. `code_version` and file hashes fill in after the first commit and download.
- **Author on the site (owner).** A short "About" line with name, profile link and "code available on request".
- **Government-wide ranges.** Still hold about half of outcomes against a nominal 80%; misses come one year at a time.
- **One pooled range for all departments.** A stable department gets the width of one cut sharply in 2025.
- **Exit-model level.** Worst yearly miss 13.6%; the quit-rate gain on test years is small.
- **Range shape.** Monotone quantiles step at a few horizons, so the band is jagged; left as published values.
- **Quality profile.** Government-wide only; department collapses are caught by notice review, not automatically.

## 6. Resume bullets (every number from `data/published/models/*.json`)

- Built Workforce Atlas, an independent analysis of OPM Federal Workforce Data (Dec 2011 to Sep 2026), with a
  contract-checked DuckDB pipeline that keeps months OPM reports incomplete out of every model.
- Backtested four headcount forecasting methods over 44 rolling origins, choosing on 2016–2022 and testing on
  2023–2024: 1.7% error a year ahead government-wide (2.9% for no-change), 6.0% through the 2025–26 shock.
- Measured forecast-range reliability instead of assuming it, and replaced fixed ranges with adaptive conformal
  intervals: department 80% ranges held 73% of test outcomes, up from 63%.
- Modelled voluntary exits with gradient boosting under year-by-year validation (Poisson deviance 2.02 against 5.42
  for a Poisson GLM and 16.17 for a department baseline), adding the BLS quit rate to cut mean yearly bias from 9.7% to
  6.0%; FY2025 exits ran 1.92× expected, 1.21× without deferred resignations (not causal).
- Flagged unusual months across 149 hiring and exit series with a seasonal robust score calibrated on 2017–2019
  (0.69% flag rate on held-out 2022–2024), keeping reported data gaps out of the signals.

Leave out "CI-checked" and test counts until a CI run is visible.

## 7. Before public release (owner)

1. Review the diff and make the first commits (author Nezz23 noreply). 2. Create the private GitHub repository.
3. Create the Cloudflare account, Pages project (Direct Upload) and a Pages-only API token; set the variables and
secret in `docs/DEPLOYMENT.md`. 4. Run the pipeline workflow once and confirm the data release. 5. Approve going live
by setting `DEPLOY_ENABLED`.
