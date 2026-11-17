#!/usr/bin/env bash
# Pack data/published into published.tar.gz (at the repo root).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d data/published ] || { echo "data/published is missing; run the pipeline first." >&2; exit 1; }
tar -czf published.tar.gz -C data/published .
echo "published.tar.gz $(du -h published.tar.gz | cut -f1)"
