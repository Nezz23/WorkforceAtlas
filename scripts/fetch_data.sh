#!/usr/bin/env bash
# Download published.tar.gz from release tag published-latest of this repo and extract it to data/published.
# Exit 3 when no such release exists yet.
set -euo pipefail
cd "$(dirname "$0")/.."
repo="${GITHUB_REPOSITORY:-}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if command -v gh >/dev/null 2>&1; then
  [ -n "$repo" ] || repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  [ -n "$repo" ] || { echo "Cannot determine the GitHub repository (set GITHUB_REPOSITORY)." >&2; exit 3; }
  if ! gh release download published-latest -R "$repo" -p published.tar.gz -D "$tmp" 2>"$tmp/err"; then
    if grep -qi "not found" "$tmp/err"; then
      echo "No 'published-latest' release in $repo yet. Run the pipeline workflow, or rebuild (docs/REPRODUCING.md)." >&2; exit 3
    fi
    cat "$tmp/err" >&2; exit 1
  fi
else
  [ -n "$repo" ] || repo="$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]##; s#\.git$##')"
  [ -n "$repo" ] || { echo "Cannot determine the GitHub repository (set GITHUB_REPOSITORY)." >&2; exit 3; }
  code=$(curl -sSL -o "$tmp/published.tar.gz" -w '%{http_code}' "https://github.com/$repo/releases/download/published-latest/published.tar.gz")
  if [ "$code" = "404" ]; then
    echo "No 'published-latest' release in $repo yet. Run the pipeline workflow, or rebuild (docs/REPRODUCING.md)." >&2; exit 3
  fi
  [ "$code" = "200" ] || { echo "Download failed: HTTP $code" >&2; exit 1; }
fi
mkdir -p data/published
tar -xzf "$tmp/published.tar.gz" -C data/published
echo "Extracted published data to data/published"
