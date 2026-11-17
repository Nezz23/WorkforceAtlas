# Deploying Workforce Atlas

Target: a **private** GitHub repository and a **public** website on Cloudflare Pages, deployed by direct upload.
GitHub Actions builds the site; only the built files go to Cloudflare, which never gets access to the repository.

## Cost

| Item | Plan | Cost |
|---|---|---|
| GitHub private repository and Actions | Free: 2,000 Actions minutes and 500 MB Actions storage a month for private repos; jobs stop, not bill, when used up | $0 |
| Cloudflare Pages | Free: static requests and bandwidth unmetered; 500 deploys a month, 20,000 files and 25 MiB per file (the site is about 800 files, the largest under 5 MB) | $0 |
| Custom domain (optional) | Any registrar; Cloudflare Registrar sells at cost | about $10–12 a year |

Without a custom domain the site lives at `https://<project>.pages.dev`. Plan limits were checked on 2026-11-17;
check again before relying on them.

## One-time setup (owner)

1. **Repository.** Create a private GitHub repository and push the first commit (author `Nezz23` noreply). Keep it
   private; do not add a license.
2. **Cloudflare.** Create a free account. In Workers & Pages, create a Pages project with **Direct Upload** (not Git)
   and note its name. Note the account ID from the dashboard.
3. **API token.** My Profile → API Tokens → Create Token → custom: permission *Account · Cloudflare Pages · Edit*,
   limited to this account. Copy it once.
4. **GitHub environment.** Settings → Environments → New environment `production`. Add the secret
   `CLOUDFLARE_API_TOKEN`. (Required reviewers on an environment need a paid GitHub plan for private repositories,
   so the gate is the `DEPLOY_ENABLED` variable, which only the repository owner can set.)
5. **Repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `SITE_URL` | `https://<project>.pages.dev` or the custom domain |
| `CLOUDFLARE_ACCOUNT_ID` | the account ID |
| `CLOUDFLARE_PROJECT` | the Pages project name |
| `DEPLOY_ENABLED` | `true`, only when you approve going live |

6. **First run.** Actions → pipeline → Run workflow. The first run rebuilds the warehouse from OPM (several hours),
   publishes the data release, builds and checks the site and, if `DEPLOY_ENABLED` is `true`, deploys it.
7. **Custom domain (optional).** In the Pages project → Custom domains, add the domain and follow the DNS steps, then
   update `SITE_URL` and run the workflow again so the sitemap, robots.txt and canonical links use it.

## What runs on each deploy

1. The `refresh` job builds `web/out` with `NEXT_PUBLIC_SITE_URL=$SITE_URL`, runs the browser and accessibility
   checks, and uploads the site as a workflow artifact.
2. The `deploy` job (environment `production`) refuses to run if a variable is missing, runs
   `scripts/check_public.sh web/out`, then `wrangler pages deploy web/out` with a pinned wrangler version.

## Before the first push: privacy checklist

Run from the repository root; each must pass.

```bash
git status --short                      # only intended files; data/, .venv/, web/out/ are ignored
git add -n . | wc -l                    # then scan exactly those files, e.g. copied to a temp dir:
gitleaks dir <copy of the files to be committed> --no-banner   # web/.next and web/out give false positives
scripts/check_public.sh web/out         # nothing private in the built site
```

Last checked 2026-11-17 (counts change as work continues): 196 files would be committed and gitleaks found no leaks
in them; the built site (813 files) has no source maps, data files, local paths or credential-shaped strings. In the
deploy job, `check_public.sh` also fails if the build still points at a local address instead of `SITE_URL`.

## Roll back or take down

- **Roll back:** Cloudflare dashboard → the Pages project → Deployments → an earlier deployment → *Rollback*.
- **Pause deploys:** set `DEPLOY_ENABLED` to anything but `true`.
- **Take the site down:** delete the Pages project (the repository is unaffected).
