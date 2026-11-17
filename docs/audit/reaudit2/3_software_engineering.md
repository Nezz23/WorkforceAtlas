# Software engineering, CI, deploy security and privacy: independent audit 2

Date: 2026-11-17. Reviewer did not build the system. Previous score: 8.0/10 (reaudit/3_software_engineering.md).

## Score: 8.4 / 10

Evidence from commands run (all on this tree):
- `npm run lint`: clean. `npx tsc --noEmit`: clean. Unit tests: 18/18 pass (run as `node --test lib/*.test.ts`, because a local hook refused `npm test`; same command).
- `npm run build`: 131 static pages, 813 files. `npm run pdf`: 249 KB PDF. `npm run test:e2e`: all PASS, 0 axe violations on 7 routes in light and dark, 0 page errors, focus ring on all 25 tab stops.
- `pytest`: 50 passed. `actionlint`: no findings. `pip-audit -r requirements.lock`: no known vulnerabilities.
- `scripts/check_public.sh web/out`: "813 files, nothing private found".
- `npm audit --omit=dev`: 0. `npm audit` (all): 14 high, all dev-only (see M2).
- `gitleaks dir .`: 432 hits, all false positives: 222 in ignored `web/.next/cache` (Next's own random build keys, never committed) and 210 in `web/out` (generic-api-key matching the data key `los_band-10-19`). Zero in source files.
- `git add -n .` would stage 193 files: no data/, parquet, .venv, out, .next, env files or local paths. Only CSVs are small hand-made `ref/*.csv` reference tables.

Why not 9: no Critical or High finding, but the deploy path has a real gap (a localhost canonical URL can ship), CI never audits npm, the CSP keeps `unsafe-inline` for scripts, and the web side has only pure-logic unit tests. Docs have small stale numbers.

## Findings

### Critical
None.

### High
None.

### Medium

**M1. A build with the wrong site URL can be deployed.** `web/app/layout.tsx:14`, `web/app/robots.ts:6`, `web/app/sitemap.ts:7` fall back to `http://localhost:3100` when `NEXT_PUBLIC_SITE_URL` is empty. The local `web/out` actually contains `Sitemap: http://localhost:3100/sitemap.xml` and canonical links. The deploy job (`pipeline.yml` deploy, "Check the build") only checks that the *variable* `SITE_URL` is non-empty in the deploy job; the build happened in the `refresh` job, which reads `vars.SITE_URL` separately, and `check_public.sh` does not look for localhost. If the variable is set after the build, or the refresh job runs with it unset, a public site with `localhost` canonicals and sitemap ships. Fix: add `localhost:3100` (and `127.0.0.1`) to the `patterns` in `scripts/check_public.sh`, run only in the deploy job or with an env flag so local checks still pass; better, make `robots.ts`/`layout.tsx` throw when `CI` is set and the variable is empty.

**M2. CI never runs `npm audit`.** `ci.yml` web job has lint/tsc/test only; Python gets `pip-audit`. Today 14 high advisories exist, all dev-only (picomatch ReDoS via eslint -> typescript-eslint -> tinyglobby; never in the shipped bundle, production audit is 0), but a runtime advisory would be invisible. Fix: add `npm audit --omit=dev --audit-level=high` to the web job (it passes now) and track the dev chain separately (bump eslint-config-next/typescript-eslint when a non-breaking fix lands).

**M3. CSP allows `'unsafe-inline'` for scripts** (`web/public/_headers:3`). The comment says Next's bootstrap needs it, and the site has one hand-written inline script (`web/app/layout.tsx:29`, theme init via `dangerouslySetInnerHTML`, constant string, not an injection risk). With no user input, no forms, no third-party hosts, the practical risk is low, but the policy gives no XSS backstop. Fix: after build, hash inline scripts (script-src 'sha256-...') in a post-build step and drop `unsafe-inline` for script-src; keep it for style-src if needed. Accept and document if not worth the churn.

**M4. Deploy supply chain.** `pipeline.yml` deploy: `npx --yes wrangler@4.164.0` pulls wrangler and its transitive deps unpinned and unhashed at run time, with `CLOUDFLARE_API_TOKEN` in the environment. Version is pinned (good) but there is no lockfile. Fix: add `wrangler` as an exact devDependency in `web/package.json` (or a tiny `deploy/package.json` with lockfile), `npm ci`, run `npx wrangler`. Also `${{ vars.CLOUDFLARE_PROJECT }}` is interpolated directly into the shell line; it is an owner-controlled variable (low injection risk), but pass it via `env:` like the others and quote `"$CLOUDFLARE_PROJECT"`.

### Low

**L1. `production` environment protection is documented as optional** (docs/DEPLOYMENT.md step 4). The monthly cron deploys unattended once DEPLOY_ENABLED is true, and a `workflow_dispatch` from any branch that can edit the workflow could use the secret. Fix: require reviewers and restrict deployment branches to `main` in the environment; state this as required, not optional.

**L2. `check_public.sh` limits.** Uses `grep -I`, so the PDF and any binary are skipped. The PDF Creator/Producer are Chromium/Skia only and contain no paths (checked with `strings`), but the script would not catch a leak there. The `api[_-]?key` pattern is fine now but could trip on data keys later. Fix: run `strings` on `*.pdf` in the script; keep the pattern list in step with what gitleaks flags.

**L3. Web test depth.** 18 unit tests cover lib logic (derive, format, simulate) and e2e covers navigation, simulator, a11y, PDF, console/CSP errors. No component or data-shape tests for the generated `web/data` JSON beyond type-checking. Acceptable for a static site; adding a schema check in `pipeline.web` tests would close it.

**L4. CI e2e skipped until a data release exists** (`ci.yml` site job). On the first push, CI proves Python and TS only; the first `pipeline` run is the first full browser check. Fine, but state it as a known first-run gap in DEPLOYMENT.md.

**L5. No Python lint/type step** in CI (no ruff/mypy). `pip-audit` is installed unpinned in the CI job (`pip install pip-audit`), acceptable for a scanner.

**L6. Stale doc facts.** `docs/DEPLOYMENT.md:58` says "130 files would be committed"; `git add -n .` stages 193 (71 are `docs/audit/screens/*.png`, 5.4 MB of audit screenshots; harmless in a private repo but consider ignoring). "812 files" there and at line 11 is now 813. `ARCHITECTURE.md` and README "131 pages" is correct (131 index.html). `git log` shows no commits yet, so "checked on 2026-11-17" claims refer to a tree that has not been committed.

**L7. Headers detail.** `_headers` syntax is valid for Cloudflare Pages (path line, indented `Name: value`, `/_next/static/*` immutable cache). HSTS lacks `includeSubDomains`/`preload` (reasonable on pages.dev). Consider adding `Cross-Origin-Opener-Policy: same-origin` and `X-Frame-Options` is redundant with `frame-ancestors`. Note that `_headers` rules only apply to files served by Pages, not to the `*.pages.dev` preview alias differently, so no gap. `serve.mjs` correctly applies only the `/*` block, so `Cache-Control` is not tested; fine.

## Workflow security review (positives)
- Top-level `permissions: contents: read`; elevated `contents: write`/`issues: write` only on the `refresh` job; deploy has `contents: read` only.
- All third-party actions pinned to commit SHAs with version comments; Python installs use `--require-hashes`.
- No `pull_request_target`, no untrusted `github.event` text interpolated in `run:`; only `github.server_url/repository/run_id` and `vars.*` appear in scripts. `set -euo pipefail` used throughout.
- Secret scoped to the `production` environment, passed via `env:` to one step only; deploy runs `check_public.sh` on the exact artifact first; wrangler version pinned; `DEPLOY_ENABLED` gate.
- Release assets (warehouse, published data) live in the private repo; the public site gets only built files.

## Privacy exposure of public site and commit set
- Public site contains aggregated OPM figures, minified JS, PDF. No source maps, data files, credentials, local paths, personal names or emails found (grep for user name, email, /Users/ across `web/out` and the PDF: clean; the only "localhost" hits are the M1 URL fallback and a bundled library string).
- `.gitignore` covers data/warehouse, raw, backup, published, web/data, web/out, .next, node_modules, .venv, caches. `web/.next/cache` holds Next signing keys but is ignored (confirmed not staged).
- Sensitive implementation details: ARCHITECTURE/DEPLOYMENT are in a private repo; none are served.

## Docs accuracy
README, ARCHITECTURE and DEPLOYMENT match the code on: workflow structure, deploy gate and variables, wrangler pinning, headers and e2e use of `_headers`, pipeline stages, page count. Inaccuracies: L6 numbers; ARCHITECTURE says "a change that breaks the policy fails CI": true only via console errors in `interact.mjs`, and CI e2e is skipped until a release exists (L4).

## Improvements since last audit (8.0)
Deploy job with environment, pinned actions, hashed Python install, `check_public.sh` gate, `_headers` enforced in e2e, a11y checks in light and dark, PDF brief build, pip-audit in CI, clean gitleaks on source, documented privacy checklist and cost table, 50 Python tests green.

## What blocks 9+
1. Fix M1 (localhost URL guard in the deploy path) and M4 (lockfile-pinned wrangler, env-passed project name).
2. Add `npm audit --omit=dev` to CI (M2) and resolve or document the dev-only advisories.
3. Move to hash-based script CSP or document the exception (M3).
4. Require reviewers/branch restriction on `production` (L1).
5. Fix stale counts and add the PDF to the public scan (L2, L6).
6. Evidence from a real first run: CI green end to end on a committed tree, a deployed preview checked with `curl -I` for the headers actually served by Cloudflare. None of that has happened yet; headers are verified only locally.
