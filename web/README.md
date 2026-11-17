# Workforce Atlas web

The Next.js 16 static export (`output: "export"`) for Workforce Atlas. See the [root README](../README.md) for what the
project is and [docs/REPRODUCING.md](../docs/REPRODUCING.md) for the full steps.

It reads JSON from `web/data/`, which `python -m pipeline.web` writes from the published data.

```bash
npm ci
npm run build       # web/out
npm run pdf         # web/out/brief/workforce-brief.pdf
npm run test:e2e    # serves out/ and runs the browser checks
npm run lint
npm test            # node --test lib/*.test.ts
npm run dev
```

`NEXT_PUBLIC_SITE_URL` sets the canonical URL, sitemap and robots.txt (default `http://localhost:3100`).
