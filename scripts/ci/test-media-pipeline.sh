#!/usr/bin/env bash
set -euo pipefail

# Runs every suite covering the media bundle pipeline. These are shell, so vitest does not see them;
# without this entry point they only ran when someone remembered to. Nothing here touches the network
# or the real bundles — the fetchers are driven against fixtures served over file://.
#
#   bash scripts/ci/test-media-pipeline.sh    (or: pnpm test:scripts)

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

for suite in media-bundle fetch-media-bundle verify-lfs-assets; do
  printf '\n=== %s ===\n' "$suite"
  bash "$script_dir/$suite.test.sh"
done

printf '\nmedia pipeline suites passed\n'
