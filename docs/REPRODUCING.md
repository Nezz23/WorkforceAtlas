# Reproducing Workforce Atlas

## Versions

- Python 3.14, with dependencies pinned and hashed in `requirements.lock` (compiled from `requirements.txt` with
  `pip-compile --generate-hashes`).
- Node: the major version in `.nvmrc` (26). `web/package.json` sets `engines.node`.

```bash
python3.14 -m venv .venv
.venv/bin/pip install --require-hashes -r requirements.lock
cd web && npm ci && npx playwright install chromium
```

## Get the data

Option 1, download the latest published data (a release asset, not in git):

```bash
scripts/fetch_data.sh      # extracts published.tar.gz from release 'published-latest' into data/published; exit 3 = none yet
.venv/bin/python -m pipeline.web
```

Option 2, rebuild from OPM:

```bash
.venv/bin/python -m pipeline.build       # fetch, validate, cube -> data/warehouse
.venv/bin/python -m pipeline.notices     # OPM data notices -> data/published/data_notices.json
.venv/bin/python -m pipeline.labour      # BLS private-sector quit rate -> data/published/labour_quits.csv (keyless API)
.venv/bin/python -m pipeline.publish
.venv/bin/python -m models.run
.venv/bin/python -m pipeline.web
```

Runtimes. `models.run`: 61 s wall clock, measured on an Apple-silicon Mac laptop (output byte-identical on re-run).
Full `pipeline.build` from an empty warehouse: several hours, not measured here; later runs only process months whose OPM
file version changed. The warehouse is about 295 MB and published data about 9.5 MB on disk.

## Build and check

```bash
cd web
npm run build        # static export to web/out
npm run pdf          # prints /brief/ to web/out/brief/workforce-brief.pdf
npm run test:e2e     # serves out/ and runs e2e/interact.mjs and e2e/a11y.mjs
npm run lint && npm run typecheck && npm test
cd .. && .venv/bin/python -m pytest -q
```

Set `NEXT_PUBLIC_SITE_URL` at build time to the public URL so the canonical link, sitemap and robots.txt are correct.

## Release assets

- `warehouse` release: `warehouse.tar.gz`, the pipeline cache (rebuildable from OPM).
- `published-latest` release: `published.tar.gz` (made by `scripts/package_data.sh`), what `scripts/fetch_data.sh` downloads.
- `published-YYYY-MM-DD` releases: dated copies of the same file.

The monthly workflow (`.github/workflows/pipeline.yml`) refreshes all three. The repository is private, so these assets
are private too. Deployment to Cloudflare Pages is off unless the repository variable `DEPLOY_ENABLED` is `true`; see
[DEPLOYMENT.md](DEPLOYMENT.md).

## Monthly review of OPM data notices

`pipeline.notices` fetches OPM's data notices. Any not yet recorded in `ref/data_notices.csv` appear under `unreviewed`
in `data/published/data_notices.json`, and the workflow opens (or comments on) an issue "Review OPM data notices".
A person reads each notice, then records it, and its resolution when there is one, in `ref/data_notices.csv`.

## Regenerate screenshots

Serve `web/out` on any static server, then run
`BASE_URL=<server url> node web/e2e/shoot.mjs <output dir> [paths...]`.
`web/e2e/serve.mjs` exports `serve(dir)` for a quick local server. The committed screenshots are in `docs/audit/screens/`.
