#!/usr/bin/env bash
# Fails if the built site would publish anything beyond the site itself: source maps, raw data files, local paths,
# environment files or anything shaped like a credential. Run on web/out before every deploy (CI and pipeline).
set -euo pipefail
out="${1:-web/out}"
[ -d "$out" ] || { echo "no build at $out" >&2; exit 1; }
fail=0
bad_files=$(find "$out" -type f \( -name '*.map' -o -name '*.parquet' -o -name '*.duckdb' -o -name '*.csv' -o -name '.env*' -o -name '*.pem' -o -name '*.key' \) | head -20)
[ -z "$bad_files" ] || { echo "Files that must not be published:"; echo "$bad_files"; fail=1; }
patterns='/Users/|/home/runner|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_|sk-[A-Za-z0-9]{20}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY|CLOUDFLARE_API_TOKEN|api[_-]?key["'\'' ]*[:=]'
hits=$(grep -rEIl "$patterns" "$out" || true)
[ -z "$hits" ] || { echo "Possible private path or credential in:"; echo "$hits"; grep -rEIoh "$patterns" "$out" | sort | uniq -c; fail=1; }
# With SITE_URL set (the deploy job), the sitemap, robots.txt and canonical links must use it, never a local address.
if [ -n "${SITE_URL:-}" ]; then
  local_hits=$(grep -rIl -E 'https?://(localhost|127\.0\.0\.1)' "$out" || true)
  [ -z "$local_hits" ] || { echo "Local addresses in a build for $SITE_URL:"; echo "$local_hits" | head; fail=1; }
  grep -q "$SITE_URL" "$out/sitemap.xml" || { echo "sitemap.xml does not use $SITE_URL"; fail=1; }
fi
[ "$fail" = 0 ] && echo "check_public: $(find "$out" -type f | wc -l | tr -d ' ') files, nothing private found"
exit "$fail"
