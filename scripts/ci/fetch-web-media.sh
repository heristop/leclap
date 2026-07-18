#!/usr/bin/env bash
set -euo pipefail

# Materializes the web build's media — the creative-kit library (music/animations/pictures/videos,
# staged into public/ by copy-core-assets.ts) plus apps/leclap-web/public/videos — from the
# ci-assets-v1 GitHub Release over HTTPS, replacing Git LFS pointer files. Fetching a release asset
# keeps deploys off the Git LFS bandwidth budget.
#
# Cloudflare Pages must set GIT_LFS_SKIP_SMUDGE=1 so its clone leaves LFS pointers instead of failing
# the checkout on the exhausted LFS budget; this script then fills those pointers in.
#
# No-op on a normal dev checkout that already has the media pulled through LFS, so it is safe to
# prepend to the web build script.

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
tag="${CI_MEDIA_TAG:-ci-assets-v1}"
asset="web-media.tar.gz"
url="https://github.com/heristop/leclap/releases/download/${tag}/${asset}"

sentinel="$repo_root/apps/leclap-web/public/videos/leclap-builder-promo.mp4"
lfs_pointer='version https://git-lfs.github.com/spec/v1'
first_line=''
[ -f "$sentinel" ] && IFS= read -r first_line < "$sentinel" || true
if [ -f "$sentinel" ] && [ "$first_line" != "$lfs_pointer" ]; then
  echo "web media already materialized — skipping release fetch"
  exit 0
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/web-media.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

echo "fetching ${url}"
curl -fsSL --retry 3 --retry-delay 2 -o "$tmp/$asset" "$url"

tar -xzf "$tmp/$asset" -C "$repo_root"

echo "extracted web media into ${repo_root}"
