#!/usr/bin/env bash
set -euo pipefail

# Downloads the CI test-media bundle and extracts it into the repository, replacing the checkout's
# Git LFS pointer files with real bytes. The bundle mirrors scripts/ci/lfs-test-assets.txt and is
# published as an asset on the ci-assets-v1 GitHub Release; fetching it over HTTPS keeps CI off the
# Git LFS bandwidth budget (release-asset downloads are not billed as LFS).
#
# Usage: fetch-test-media.sh [repo-relative-path ...]
#   With no arguments the whole bundle is extracted. Passing paths extracts only those members
#   (used by the Rust job, which needs a single fixture).

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
tag="${CI_MEDIA_TAG:-ci-assets-v1}"
asset="ci-test-media.tar.gz"
url="https://github.com/heristop/leclap/releases/download/${tag}/${asset}"

tmp=$(mktemp -d "${TMPDIR:-/tmp}/ci-test-media.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

echo "fetching ${url}"
curl -fsSL --retry 3 --retry-delay 2 -o "$tmp/$asset" "$url"

tar -xzf "$tmp/$asset" -C "$repo_root" "$@"

echo "extracted CI test media into ${repo_root}"
