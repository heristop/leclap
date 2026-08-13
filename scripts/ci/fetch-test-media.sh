#!/usr/bin/env bash
set -euo pipefail

# Materializes the media CI needs to run the real-render suites — every Git LFS asset listed in
# scripts/ci/lfs-test-assets.txt — from the prebuilt ci-test-media.tar.gz bundle.
#
# Usage: fetch-test-media.sh [repo-relative-path ...]
#   With no arguments the whole bundle is extracted and verified. Passing paths extracts and verifies
#   only those members (used by the Rust job, which needs a single fixture).
#
# Environment: see fetch-web-media.sh — CI_MEDIA_BASE_URL, CI_MEDIA_TAG, CI_MEDIA_MANIFEST, REPO_ROOT.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/fetch-media-bundle.sh
source "$script_dir/fetch-media-bundle.sh"

media_fetch_bundle ci-test-media.tar.gz scripts/ci/lfs-test-assets.txt "$@"
