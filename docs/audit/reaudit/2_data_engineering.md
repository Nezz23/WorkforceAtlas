# Re-audit 2: Data engineering (read-only)

Score: 7.5/10. (Code is sound and tested; nothing has ever run in CI, the repo has 0 commits, the shipped warehouse lacks sha256.)

## First-audit findings
| ID | Status | Evidence |
|---|---|---|
| C2 (repo/README) | Partly | README.md, REPRODUCING.md exist. `git ls-files | wc -l` = 0: branch `remediation` has no commits; nothing is on GitHub. |
| H7 gitignore | Resolved | `.gitignore` has data/warehouse/, data/build.log, data/published/, web/data/. `git add -n . | grep data/` = empty; `git check-ignore -v` hits. |
| H8 workflow | Partly (unrun) | actionlint: clean. concurrency `pipeline`, cancel-in-progress false (pipeline.yml:8). Restore is strict: `set -euo pipefail`, only "not found" means rebuild, other errors exit 1 (:31-40). Save is `always()`, gated on sources.json, runs before the node build. sources.json is written atomically after each file (build.py:57-63, tests prove it). SHA pins resolve (`gh api .../git/commits/<sha>` x3 OK). Never executed: no repo. |
| Manifest stale warnings | Resolved | `quality_profile` recomputed per publish (publish.py:59). Real warehouse: 26 warnings, e.g. employment 201502 "department missing for 0.01%". |
| Completeness/contiguity | Resolved | Real warehouse: all 3 streams 201112-202609, 178 months, `assert_complete` passes. Unit tests cover gap, year-end, mismatched ends. |
| "No Data Reported" | Resolved | Nulled in all 6 publish SQL files; counted as missing dept in the profile (publish.py:69). Real share is about 0.0002, so it is correctly small. |
| Hash + code version | Partly | Code present (build.py:60, publish.py:~265), tested. Real artifacts: `manifest.sources.employment.201112.sha256 = None`; 534 sources.json entries lack sha256; `code_version = None` (no commit). Fills only after a full rebuild or a re-versioned month. |
| Idempotency tests | Resolved | tests/test_pipeline_contract.py:48-60; 42 passed. Also passes in a data-less copy (CI mirror). |
| `dump(default=str)` | Resolved | web.py:23 `scalar` raises TypeError, tested. |
| Issue dedupe | Resolved (unrun) | `gh issue list --search ... | select(startswith)` then comment or create, for both failure and review (pipeline.yml:84-100). Logic reads right; unproven. |
| Actions pinned / `permissions:` | Resolved | SHA pins; top-level `contents: read` in both workflows; job-level write only in `refresh`. |
| Notice layout drift | Partly | See N1/N2. |

## New findings
**High**
- H-A: Restore is not atomic with Save. `gh release upload --clobber` replaces the asset in two steps; a cancel or timeout mid-upload (360-min limit, first run rebuilds 534 files) leaves the release with no `warehouse.tar.gz`. Next restore then hits `gh release download` failure, exits 1, and the monthly cron stays red until someone fixes the release by hand. Fix: upload to a dated or temp tag then re-point, or treat a missing asset the same as "not found". pipeline.yml:36, 56-58.
- H-B: Nothing has run end to end. 0 commits, no remote, so: Playwright in CI, `gh release create` perms, the vercel static-export layout, and the first-ever full rebuild time are all unverified. Fix: commit, push to a private repo, `workflow_dispatch` once, read the logs.

**Medium**
- M-A (N1): Notice parser fails open silently. `parse()` keeps only bullets containing "missing". If OPM rewords ("absent", "not received") you get 0 new notices and no error. I confirmed it: `parse([{bullets:["Some records are absent for Treasury in October 2026 Status"]}]) == {}`. Only a page with zero `release-note-heading` blocks raises (notices.py:~107). Fix: fail if the latest release has bullets mentioning months but yields no notice and no reviewed row; compare banner presence to active notices.
- M-B (N2): `departments()` regex `[A-Z]{2}[0-9A-Z]{2}` mis-scopes. "EHRI" gives scope `EH`, "NASA" gives `NA` (verified). Bogus scopes are inert but the real department's gap is missed; an unreviewed bogus row opens a review issue every month. Fix: match against the known department-code list from the warehouse names cube.
- M-C: `pipeline.notices` hard-fails the whole run on an HTML fetch error (no retry beyond `_open`, no fallback to the previous data_notices.json), and it sits before publish. A flaky OPM site blocks a healthy refresh. Fix: continue-on-error, keep the old file, add a warning.
- M-D: The quality profile is government-wide only. The DOD Sep 2026 separation collapse (1,727 vs 7,950) is invisible in `manifest.warnings` (empty for 2026-09); it is caught only through the hand-reviewed CSV. Fix: profile per department, ratio-to-median with the same 0.5-2 band.
- M-E: First-ever CI path. `ci.yml` `site` job skips until a `published-latest` release exists (exit 3, `::notice::`). Reasonable, but until then PRs never build the site; only the monthly job does, and it deploys only after publishing the data release. Acceptable; document it.

**Low**
- L-A: Publish ordering. In pipeline.yml, `publish` and `models.run` write data/published before `pytest`, but release upload happens after pytest and e2e, so nothing public changes on failure. Good. But the Save-warehouse step precedes the data release, so the warehouse can be ahead of the published release; harmless since idempotent.
- L-B: `pip install pip-audit` (ci.yml:22) is unpinned and not hashed; `npx vercel` unpinned (pipeline.yml deploy). Python 3.14 pinned in the lock; local default python3 is 3.15 (fine; the .venv is used).
- L-C: `fetch_data.sh` extracts the tarball without a checksum; `published.tar.gz` has no hash in its release. Minor given the same-repo source.
- L-D: `publish.py:main` reads `data/warehouse/names/*.parquet` by a relative path (cwd-dependent), while the SQL files do too (`sql/*.sql` use `data/warehouse/...`). Works only from the repo root. Fix: parameterise on ROOT.
- L-E: `code_version` falls back to None without git; make that an error in CI (`GITHUB_SHA` is always set there, so it is fine in practice).

## Caveats
Not executed: any workflow, `gh` release writes, Vercel deploy, network fetch of OPM (I did not call it, read-only). Scored on code reading, actionlint, tests (42 pass), and real-warehouse checks.

## Summary
1. Score 7.5/10 (up from 7.0).
2. Closed: H7, completeness, quality profile, No Data, idempotency, SHA pins and permissions. Partly: C2, H8, sha256/code_version, notice robustness.
3. Counts: Critical 0, High 2, Medium 5, Low 5.
4. Top issues: (1) the pipeline has never run, repo has 0 commits; (2) the clobber-upload can leave the warehouse release without its asset and wedge every future run; (3) notice parser fails open silently and mis-scopes department codes ("EHRI"->EH).
5. Shipped manifest has `sha256: null` and `code_version: null` until a rebuild on a commit.
