# PROJECT_STATUS

**Project:** Workforce Atlas, an independent intelligence platform for the U.S. federal workforce.
**Phase:** audit remediation (see `docs/REMEDIATION.md`); not yet released.
**Last updated:** 2026-11-17

## Decisions
| ID | Decision | Date |
|---|---|---|
| D-1 | Primary data: OPM Federal Workforce Data (public, record-level, no person ID) | 2026-11-15 |
| D-2 | Modules: Executive Brief; Mobility & Retention; Planning & Forecasting; Compensation; Methods; department profiles | 2026-11-15 |
| D-3 | Stack: Python + DuckDB + SQL pipeline in GitHub Actions → static Next.js site; no server, no database | 2026-11-15 |
| D-5 | Window: monthly from 2011-12 (opening stock) to latest; quarterly 2005–2011 deferred | 2026-11-16 |
| D-6 | Group-level models only; no individual scores (no person ID exists) | 2026-11-15 |
| D-7 | No pay equity by protected class (OPM withholds those fields) | 2026-11-15 |
| D-8 | Flows counted in the month OPM processed them; late actions published as a share (3.95%) | 2026-11-16 |
| D-9 | Government-wide flows exclude transfers between agencies; department flows include them | 2026-11-16 |
| D-10 | Statistical shifts warn; only structural contract breaks stop the pipeline | 2026-11-16 |
| D-11 | Forecast method chosen per level (government-wide, departments) on targets to 2022; 2023–2024 test; 2025+ reported apart (supersedes one-method rule) | 2026-11-17 |
| D-13 | OPM release-note data notices, reviewed in `ref/data_notices.csv`, mark department-months as reporting gaps; models never read them as change | 2026-11-17 |
| D-14 | Simulator flows are published as hires, exits and an explicit 'other change' that add to the forecast | 2026-11-17 |
| D-12 | Browser reads pre-built JSON per scope; DuckDB-WASM and occupation/grade cross-filters deferred (fewer parts) | 2026-11-16 |

## Done
- Phase 1 research: `docs/research/01-phase1-research-report.md`
- Phase 2 design: `docs/02-phase2-product-design.md` (pay-hidden figure corrected to 47.1%)
- Phase 3 pipeline: `pipeline/` (fetch, contract, cubes, publish, GS pay tables), 534 OPM files, no contract failures; `.github/workflows/`
- Phase 4 frontend: `web/` static Next.js site; 19 review findings fixed; second review run
- Phase 5 models: forecast, unusual months, retention curves, exit-rate model, simulator, printable monthly brief. Methodology: `docs/05-models.md`
- Pre-publication checks: `docs/reference/verification.md` (OPM release terms, DRP dates, revision sizes)
- Tests: 21 Python (pipeline + models), 4 simulator, 15 browser interactions, axe WCAG 2.2 AA scan with 0 violations in both themes

## Key verified figures (2026-09 data)
- Headcount 2,017,021: lowest since 2012; 296,541 below the October 2024 peak
- September 2025: 119,461 separations excluding transfers, 96,165 DRP-flagged
- Pay hidden on 47.1% of records; GS coverage 57.5% observed, 99.8% with derived base pay
- Forecast WAPE at 12 months: 1.6% before 2025, 6.2% on 2025–26 targets

## Next
1. Owner's final review of the local site
2. Create the GitHub repo; enable the monthly workflow (stores the warehouse as a release asset)
3. Deploy to Cloudflare Pages by direct upload (static `web/out`); see docs/DEPLOYMENT.md
4. README and portfolio write-up

## Open
- Spring 2025 agency-level DRP follow-on offers are reported only by unofficial sources; the site names no later round.
- Derived pay unavailable for 2012–2013 (OPM tables not published in the same form).
