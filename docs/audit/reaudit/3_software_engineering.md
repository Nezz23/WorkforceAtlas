# Re-audit 3: Software engineering (2026-11-17)

Score: 8.0/10 (was 7.5)

## Commands I ran
pytest 42 pass; eslint 0; tsc 0; node tests 18/18; next build OK (134 pages); npm run pdf OK (284,697 B, out/brief/workforce-brief.pdf); test:e2e 15 e2e PASS + axe 0 violations on 14 page/theme combos; npm audit 0 vulns; pip-audit clean; secrets grep: none. Bundles: 3 JS chunks >100 KB (229/170/113 KB raw), all JS gzipped 227 KB total; out/ 27 MB (d/ 23 MB).

## First-audit findings
| ID | Status | Evidence |
|---|---|---|
| H9 PDF stale/404 | Resolved | brief/page.tsx:23 uses monthless `workforce-brief.pdf`; `npm run pdf` writes it; e2e asserts PDF served (content-type pdf); public/brief empty, gitignored |
| H10 CI/lint | Resolved | eslint 0; ci.yml has python (pytest, pip-audit), web (lint, tsc, test), site (build, pdf, e2e) jobs. Caveat below (site job skips) |
| Medium: OG/metadataBase/robots/sitemap | Partly | exist (layout.tsx:14-19, sitemap.ts, robots.ts) but see S1, S2: canonical wrong on every page, localhost URL baked in |
| Medium: actions pinned by tag; no permissions | Resolved | all `uses:` are 40-char SHAs; `permissions: contents: read` in both workflows; per-job elevation |
| Medium: derive/format untested; last12 unknown month | Resolved | derive.test.ts 65 lines, format.test.ts; last12 throws on empty/absent month (derive.ts:25-27), tested |
| Medium: web/data 38 MB committed | Resolved | `web/data/` gitignored; data fetched from release (scripts/fetch_data.sh) |
| H8 (pipeline) in SE view | Resolved | restore fails on non-"not found" error, concurrency group, build+pdf+e2e in workflow, deploy job gated |
| Low: 5 unused SVGs, AGENTS.md, _audit_shoot.mjs | Resolved | not present (web/public holds only brief/; no AGENTS.md; e2e has 6 purposeful scripts) |
| Low: tsconfig.tsbuildinfo | Partly | file still on disk, but gitignored (*.tsbuildinfo) |
| Low: data/backup undocumented | Partly | gitignored; still present, README/REPRODUCING do not mention it |
| Low: `dump(default=str)` | Resolved | grep default=str in pipeline/: none |
| Low: no idempotency test | Resolved | tests/test_pipeline_contract.py "Build idempotency..." |
| Low: failure issue dedupe | Resolved | pipeline.yml searches open issue, comments instead of creating |
| C2 repo/README | Partly | README + .gitignore exist, but `git log`: branch `remediation` has zero commits, everything untracked. Nothing is verifiably committed |
| Manifest hash/code version | Partly | sha256 per source present (build.py:77); `code_version` is **null** in the current manifest (no commits yet) |

## New-code review
Good: models.ts/context.ts are small, typed, sourced; data.ts throws loudly on a missing fact; Notices/Alerts are pure and keyed; Header uses useSyncExternalStore for theme (no hydration flash), native `<dialog>` for the palette; PlanningLab uses useSyncExternalStore for matchMedia with a server snapshot; simulate.ts is pure with real-value assertions (not smoke tests); e2e/serve.mjs has no deps; e2e checks behaviour (before/after simulator value, theme persistence, focus rings).

## Remaining findings

### High
- S1 `web/app/layout.tsx:16`: `alternates: { canonical: "/" }` in the root layout is inherited by every page. Verified in out/: /d/TR/ and /mobility/ both emit `<link rel="canonical" href="http://localhost:3100/">`. Tells search engines every page duplicates the homepage. Fix: drop it from layout; set `alternates.canonical` per page (generateMetadata in d/[code]) or rely on metadataBase only.
- S2 Deployed build would publish localhost URLs. `NEXT_PUBLIC_SITE_URL` is read in layout.tsx:14, sitemap.ts:7, robots.ts:6 with a `localhost:3100` fallback, and is set in neither workflow nor build script (out/sitemap.xml and robots.txt are all localhost). Fix: set it in pipeline.yml build step (from a repo variable) and make the build fail when `CI` is set and it is empty.

### Medium
- S3 `PlanningLab.tsx:70` scope change resets pins only, not levers (`onChange` at the `<select>`). Switching from ALL with a large one-time exit to a small department leaves `oneTimeExit` above the slider `max` (max = 10% of start.v, line ~96), so the output shows a value the slider cannot show and the scenario is silently extreme. Fix: `setLevers(DEFAULT_LEVERS)` alongside `setPins([])`, or key the lab by `code`. No test covers it.
- S4 `ci.yml` site job (the only one running build, pdf, e2e, axe) skips silently, with a notice, when there is no `published-latest` release. CI green does not prove the site builds. Until a release exists, the web job should also run `npm run build` against a small fixture. Same job runs on every push with `playwright install --with-deps` (slow); fine once data exists.
- S5 Palette (`Header.tsx`, ~l.117): `role="listbox"` > `role="option"` wrapping `<button>` = nested interactive content; input is not a combobox and has no `aria-activedescendant`, so screen-reader users get no announcement of the highlighted result. Fix: `role="combobox"` + `aria-controls` + `aria-activedescendant`, options with ids and no inner button (click on the li).
- S6 Chart tooltip `kit.tsx:26` is `role="status"` (live region) fed by pointer hover only: noisy when it announces, and invisible to keyboard users. "View as table" is the mitigation (tested by e2e) but the line charts themselves expose no keyboard data. Acceptable if the table toggle is on every chart; verify, and drop role=status.
- S7 `PlanningLab.tsx:38` `eslint-disable react-hooks/exhaustive-deps`: `base` is rebuilt each render and the memo depends on `[code, levers]`. Works, but it is a lint suppression hiding a real dependency; `pathSeries` also re-simulates every pin on each render. Fix: `useMemo` the `base` on `s`, depend on `[base, levers]`, remove the disable.
- S8 `code_version: null` in the shipped manifest (pipeline/publish.py:275 falls back to None). A published artefact without provenance weakens the "reproducible" claim. Fix: make publish fail in CI when neither GITHUB_SHA nor git commit resolves; commit the repo (zero commits now).

### Low
- S9 Tests do not cover: `simulate` clamp at zero (`Math.max(0,...)`, simulate.ts:35: after clamping, later deltas still accumulate from the unclamped value, so the path can stay 0 long after it should recover); `annualRates`; the `horizon` argument; lib/models.ts accuracy(); Notices/Alerts rendering. Component tests are absent altogether; behaviour is covered only by e2e smoke.
- S10 `e2e/interact.mjs` uses `waitForTimeout(200)` (flaky pattern, use expect/waitFor on the output) and hard-codes "25 tab stops". `a11y.mjs` scans 7 of 134 pages (fine) but not `/` with palette open or the lab with a scenario applied.
- S11 `e2e/serve.mjs:15` `file.startsWith(base)` path check is prefix-based (`/x/out-evil` passes); test-only, localhost-only. Use `base + path.sep`.
- S12 Open Graph: no `og:image`, no per-page OG title/url; twitter card `summary` with no image. `sitemap.ts` has no lastmod.
- S13 `data/backup/warehouse_20261116_*` and `tsconfig.tsbuildinfo` still on disk (ignored); document or delete before publishing the repo.
- S14 No dependency-update automation (Dependabot/Renovate) now that actions are SHA-pinned; pins will rot.
- S15 `components/Notices.tsx:6` hard-codes `DOD: "Department of War"` display override; a stray data-specific constant inside a presentational component (move to titleCase/scopes data).
- S16 27 MB static output, 23 MB of it department pages; acceptable, but each of 124 pages ships its full JSON in RSC payloads (`__next*.txt`). Watch if scopes grow.

## Counts
Critical 0, High 2, Medium 6, Low 8.
