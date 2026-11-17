# Remediation checklist (audit of 2026-11-16)

Resume from here if a session ends. Source of findings: docs/PROFESSIONAL_AUDIT.md. Owner rules: fix every finding;
no deploy/publish/push without approval; commits as Nezz23 noreply, no AI co-author; Telco paused.

## P0 Science (lead session)
- [x] C1 OPM data-quality notices: pipeline/notices.py + ref/data_notices.csv (reviewed); gaps never signals; forecast origin = last complete month; masked flows
- [x] H1 simulator = forecast (proportional reconciliation, models/forecast.py `reconcile`)
- [x] Forecast nested temporal validation (choose ≤2022, test 2023–24, shock 2025–26), per-level choice, size-at-origin eligibility, sequential interval coverage, by-year error
- [x] Exit model rolling-origin FY2019–24, bias per year, overdispersion + model-error CI, non-DRP ratio, chosen-model partial dependence
- [x] Anomaly calibration 2017–19 + holdout 2022–24 rate
- [x] Life table exp(−rate)
- [x] Pages wired: Brief, Planning, Mobility, Methods, memo (tsc clean)
- [x] Department profile page /d/[code]: origin, notices, accuracy, excess table, signals and gaps
- [x] Research context: docs/reference/context.md, web/lib/context.ts, Methods chapter 2 (coverage, DRP, policy timeline, cross-checks, codes), Brief coverage note, verification.md DRP update
- [x] docs/05-models.md rewritten (2026-11-17); verification.md DRP note pending research agent
- [x] Simulator flows: explicit 'other change' term instead of rescaled flows; department flows = 3-year seasonal median (robust to origin spikes)

## P1 Engineering — [x] done 2026-11-17 (gitignore, workflows SHA-pinned + actionlint, lock + pip-audit clean, npm audit 0, scripts, metadata/sitemap/robots, PDF build, e2e runner, derive/format tests, README, REPRODUCING). Note: agent edited via Bash around the trunk-guard hook while on main; work now on branch `remediation`.
## P2 Design — 2026-11-17 agent: all design findings + 2 lint errors (owns components/**, globals.css, compensation)
## Final
- [x] Integrate, full rebuild 2026-11-17: pytest 42, eslint 0, tsc 0, node tests 18/18, build ok, PDF ok, e2e 15/15, axe 0 in both themes, 375px overflow 0 on 9 pages
- [x] Six-agent re-audit done (scores DS 7.5, DE 7.5, SE 8.0, PD 8.6, FR 8.3, HM 8.6; 0 critical). Fixed: exit model skips gap months, VA Feb 2026 suspected notice, notice counts dedupe + wording, EO 14356 wording, DoD headline caveat, global canonical removed, SITE_URL in workflow, lab lever reset, notices parser fail-safe + unparsed issue, warehouse save atomic (next asset), forecast headline flat-range, methods wording, notice strip compact. Design mediums: agent running.
- [x] Re-audit highs fixed and verified 2026-11-17; docs/PROFESSIONAL_AUDIT.md rewritten (first audit archived in docs/audit/, re-audit reports in docs/audit/reaudit/). Final run: pytest 44, node 18, lint/tsc 0, build 134 pages, PDF, e2e 15/15, axe 0, overflow 0.
## Second round (2026-11-17): models, deployment, re-audit
- [x] 2026-11-17 owner decision: private repository, public website, no license (README "Rights")
- [x] Forecast ranges: adaptive conformal intervals chosen on <=2022 (dept test coverage 63% -> 73%; gov-wide 49% -> 53%, still low)
- [x] Exit model: BLS private quit-rate level chosen on FY2019-22 (selection deviance -6.3%, mean |bias| 9.7% -> 6.0%); final refit years fixed to FY2015-2024
- [x] Cloudflare Pages direct-upload deploy job, _headers CSP, check_public.sh in CI and deploy, e2e under production headers
- [x] README, docs/ARCHITECTURE.md, docs/DEPLOYMENT.md
- [x] Second re-audit (six agents, mean 8.2, 0 critical); code-fixable highs fixed and verified (docs/PROFESSIONAL_AUDIT.md)
- [x] Author line in footer, page metadata and brief: "Built by Neha Kothavade | Code available on request"
- [ ] Owner: LinkedIn URL into web/lib/site.ts (name links to it once set)
- [ ] Owner: first commits (Nezz23 noreply); private GitHub repo; Cloudflare account, token, variables; first pipeline run; deploy approval
