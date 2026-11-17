# Workforce Atlas: Professional Audit (re-audit after remediation)

Date: 17 November 2026. Branch `remediation`, nothing committed, pushed or deployed. The first audit (16 November,
verdict NO-GO, mean 7.4) is kept at `docs/audit/PROFESSIONAL_AUDIT_2026-11-16.md`. The six fresh reviewers' full
reports, with the evidence for every finding, are in `docs/audit/reaudit/`.

Method: six new review agents, none of which built the fixes, each re-checked every first-audit finding with its own
commands, file references or screenshots, then looked for new problems. Their high findings were then fixed and
re-verified by the lead (section 3); scores below are the reviewers' own, given before those fixes, and are not raised
here without a new review.

## Verdict

**Ready to showcase locally. GO for public release once the owner does four things that only the owner can do:**
choose a license, make the first commits, set the public address (`SITE_URL`), and approve the deploy. No critical
finding remains in any category, and every high finding the re-audit raised has been fixed and re-verified.
It does not reach 9 in every category yet; section 5 says exactly why.

## 1. Scores

| Category | First audit | Re-audit | Main evidence |
|---|---|---|---|
| Data science | 6.5 | **7.5** | H1–H4 reproduced independently; interval coverage still poor |
| Data engineering | 7.0 | **7.5** | gitignore, contract, completeness, idempotency verified; nothing has run in CI |
| Software engineering | 7.5 | **8.0** | all checks green; canonical and site-URL bugs (since fixed) |
| Product design | 8.0 | **8.6** | 3 first-audit highs resolved; Methods density, survival chart (since fixed) |
| Federal workforce research | 7.5 | **8.3** | context verified at source; DoD gap-month totals (since caveated) |
| Hiring manager / portfolio | 8.0 | **8.6** | strong artifact; not public, no history |
| **Mean** | **7.4** | **8.1** | 0 critical findings, down from 2 |

## 2. First-audit findings: status

| # | Finding | Status | Evidence |
|---|---|---|---|
| C1 | Sept 2026 DoD "signals" were an OPM ingestion gap | Resolved | `pipeline/notices.py` reads OPM release notes; `ref/data_notices.csv` records review; gaps listed apart, never as signals (`anomaly.json` `gaps_recent`) |
| C2 | No repo, README, URL | Partly | `git init`, `README.md`, `docs/REPRODUCING.md`; no commits or URL (owner decision) |
| H1 | Simulator baseline ≠ forecast | Resolved | hires − exits + other change = forecast change: 220,143 − 201,162 − 17,881 = +1,099 (`forecast.json`) |
| H2 | 1.76× excess mostly DRP | Resolved | FY2025: 1.77 all, 1.12 excluding DRP; both shown, neither called causal |
| H3 | CI ignored overdispersion | Resolved | log-scale interval with dispersion 7.25 and model-error SD 0.156 |
| H4 | FY2024 bias unreported | Resolved | rolling-origin by year; bias −17.5% to +16.3% published on Mobility and Methods |
| H5 | Coverage exclusions unstated | Resolved | Methods chapter 2 lists OPM's own exclusions with source links |
| H6 | Policy record missing; DRP note outdated | Resolved | 11-entry dated timeline from primary sources; FY2026 agency DRP rounds stated |
| H7 | Warehouse would be committed | Resolved | `git add -n .` lists no data paths |
| H8 | Pipeline not end-to-end | Partly | build → notices → publish → models → site → PDF → e2e → release, strict restore, concurrency, issue dedupe; never run |
| H9 | Stale PDF | Resolved | month-less PDF built by `npm run pdf` in CI and the monthly workflow |
| H10 | CI gated only pytest; lint red | Resolved | CI runs pytest, pip-audit, eslint, tsc, unit tests, build, PDF, e2e |
| H11–H13 | Tablet nav, phone simulator, survival labels | Resolved | nav switches below `lg`; sticky chart over levers on phones; survival end labels redesigned |
| Medium/Low | All others | Resolved or stated as limits | see `docs/REMEDIATION.md` and `docs/audit/reaudit/` |

## 3. Re-audit high findings, fixed after the re-audit

| Reviewer | Finding | Fix |
|---|---|---|
| Data science | Exit model and its FY2026 ratios read DoD gap months | Gap department-months dropped from exits and exposure; FY2026 all-departments ratio 1.39 → 1.51, excluding DRP 1.05 → 1.12 |
| Data science | Suspected-gap rule applied to DoD only | Veterans Affairs Feb 2026 (808 separations against ~2,600, all categories) added as suspected |
| Data engineering | Warehouse upload not atomic | saves `warehouse-next.tar.gz` first; restore falls back to it |
| Data engineering | Notice parser failed open; read "EHRI"/"NASA" as codes | gap words broadened; unparsed gap bullets and fetch failures open an issue; codes only from component lists; 2 new tests |
| Software engineering | Every page's canonical pointed home | global canonical removed |
| Software engineering | Sitemap and robots said localhost | `SITE_URL` variable wired into the build; deploy refuses to run without it |
| Federal research | DoD totals and headline include gap months | DoD headline caveated; every notice says which figures still include gap months |
| Federal research | Notice record counts double-counted; wording overclaimed | one count per OPM bullet; "reported missing and not yet announced received" |
| Federal research | EO 14356 "replaced the freeze" not in the order | effect reworded to what the order requires |

Mediums fixed in the same pass include: forecast intervals made non-narrowing in the model (the chart draws the
published values, no visual smoothing); Methods chapter 2 restructured; survival chart reduced to two strong curves;
share view capped at 100%; compact data-notice strip; simulator levers reset on department switch; forecast headline
says "roughly flat" when the change sits inside its 80% range; Pew cross-checks added (December 2025 headcount
2,074,649 and −10.3% match exactly).

## 4. Verification run (17 November 2026, after all fixes)

| Check | Result |
|---|---|
| Python tests | 44 passed |
| Web unit tests (`node --test`) | 18 passed |
| ESLint / TypeScript | 0 errors / 0 errors |
| `pip-audit` / `npm audit` | no known vulnerabilities / 0 |
| `npm run build` | 134 static pages |
| `npm run pdf` | `out/brief/workforce-brief.pdf` built |
| Browser checks (`npm run test:e2e`) | 15 of 15 pass |
| Accessibility (axe, WCAG 2.2 AA) | 0 violations, 7 pages × light and dark |
| Phone width 375 px | no horizontal overflow on 9 pages |
| Workflows | actionlint clean; actions pinned by SHA |

## 5. What still stands between this and 9+

- **Not public.** No commits, no license, no live URL, no data release. The pipeline has never run in CI. This is the
  largest gap for a reviewer and only the owner can close it.
- **Forecast ranges were too narrow.** Ranges built from earlier errors held 49% (government-wide) and 63%
  (departments) of 2023–2024 outcomes, and 18% and 33% in 2025–2026, against a nominal 80%. The site says so and the
  published ranges now include the 2025–2026 errors, but no regime-aware or conformal method has been tested.
- **Exit model level bias.** It ranks groups well but has missed whole-year totals by up to 17%.
- **Smoothing learns the 2025 step-down** for departments; stated as a limit, not modelled.
- **Historic files have no recorded hash**; hashes start with the next download. `code_version` fills in after the
  first commit.
- **Quality profile is government-wide**, so a single-department collapse is caught by review of OPM notices and the
  suspected-gap rows, not automatically.
- **Breadth.** OPM's own Table Builder still leads on drill-down depth and custom queries; "independent analysis" is a
  more defensible description than "intelligence platform".

## 6. Resume bullets (every number traceable)

- Built Workforce Atlas, an independent analysis of OPM Federal Workforce Data from December 2011 to September 2026,
  with a contract-checked DuckDB pipeline that reconciles every source file and marks months OPM reports incomplete
  (`data/published/manifest.json`, `data_notices.json`).
- Forecast federal and department headcount with four candidate models chosen on 2016–2022 and tested on 2023–2024
  (1.7% government-wide error a year ahead), and published how often the ranges held (`forecast.json`).
- Modelled voluntary exit rates with gradient boosting under year-by-year validation (87% lower deviance than a
  department baseline), showing FY2025 exits at 1.77× expected, or 1.12× without the Deferred Resignation Program
  (`exit_model.json`).
- Flagged unusual monthly hires and exits across 149 series with a seasonal robust score (0.69% flag rate on held-out
  2022–2024) while keeping reported data gaps out of the signals (`anomaly.json`).
- Shipped a static Next.js site with custom D3 charts, a what-if simulator that reproduces the forecast exactly, and a
  printable monthly brief, checked by automated accessibility and browser tests in CI.

## 7. Before public release (owner)

1. Choose a license. 2. Review the diff and make the first commits (author Nezz23 noreply). 3. Create the GitHub
repository and set `SITE_URL`. 4. Run the pipeline workflow once by hand and confirm the data release. 5. Approve the
deploy, then set `DEPLOY_ENABLED` and `VERCEL_TOKEN`.
