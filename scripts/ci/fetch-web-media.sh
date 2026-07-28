#!/usr/bin/env bash
set -euo pipefail

# Materializes the web build's media — every Git LFS asset listed in scripts/ci/lfs-web-assets.txt
# (the creative-kit library staged into public/ by copy-core-assets.ts, plus the web's own clips) —
# from a prebuilt bundle over plain HTTPS, replacing the checkout's LFS pointer files. Fetching a
# bundle keeps deploys off the Git LFS bandwidth budget, which this repo has exhausted: LFS downloads
# now return 403, and `git lfs pull` reports success while materializing nothing.
#
# Cloudflare Pages must set GIT_LFS_SKIP_SMUDGE=1 so its clone leaves LFS pointers instead of failing
# the checkout on the exhausted budget; this script then fills those pointers in.
#
# Every asset in the manifest is checked, before and after the fetch. An earlier version trusted a
# single sentinel file, so a checkout where only *some* media was real skipped the fetch and the build
# silently shipped pointer files in place of videos.
#
# Environment:
#   CI_MEDIA_BASE_URL  where bundles live. Defaults to the ci-assets-v1 GitHub Release; point it at an
#                      R2 bucket (or any static host) to move media off GitHub without code changes.
#   CI_MEDIA_TAG       release tag, when using the default GitHub base URL.
#   CI_MEDIA_MANIFEST  manifest path. Defaults to scripts/ci/lfs-web-assets.txt.
#   REPO_ROOT          tree to materialize into. Defaults to the enclosing git checkout.

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
tag="${CI_MEDIA_TAG:-ci-assets-v1}"
asset="web-media.tar.gz"
base_url="${CI_MEDIA_BASE_URL:-https://github.com/heristop/leclap/releases/download/${tag}}"
url="${base_url}/${asset}"
manifest="${CI_MEDIA_MANIFEST:-$repo_root/scripts/ci/lfs-web-assets.txt}"

lfs_pointer='version https://git-lfs.github.com/spec/v1'

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[ -f "$manifest" ] || fail "media manifest not found: $manifest"

# Manifest entries, one per line: comments and surrounding whitespace stripped.
manifest_entries() {
  sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "$manifest" | grep -v '^$'
}

# An asset counts as materialized only when it exists and does not start with the LFS pointer header.
unmaterialized() {
  local entry path first
  while IFS= read -r entry; do
    path="$repo_root/$entry"

    if [ ! -f "$path" ]; then
      printf '%s\n' "$entry"
      continue
    fi

    first=''
    IFS= read -r first < "$path" || true
    [ "$first" = "$lfs_pointer" ] && printf '%s\n' "$entry"
  done < <(manifest_entries)
  return 0
}

total=$(manifest_entries | grep -c '' || true)
[ "$total" -gt 0 ] || fail "media manifest has no entries: $manifest"

missing=$(unmaterialized)

if [ -z "$missing" ]; then
  echo "web media already materialized ($total assets) — skipping bundle fetch"
  exit 0
fi

missing_count=$(printf '%s\n' "$missing" | grep -c '')
echo "fetching ${url} (${missing_count}/${total} assets missing)"

tmp=$(mktemp -d "${TMPDIR:-/tmp}/web-media.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

if ! curl -fsSL --retry 3 --retry-delay 2 -o "$tmp/$asset" "$url"; then
  # The bundle is the only way in: Git LFS returns 403 for this repo, so there is no fallback to
  # suggest. Say exactly how to put the bundle back rather than failing with a bare curl exit code.
  fail "could not download ${asset} from ${url}
  The media bundle is missing or unreachable. To rebuild and republish it from a checkout that has
  the media materialized:
      bash scripts/ci/build-media-bundles.sh
      gh release upload ${tag} dist/ci-media/${asset} --clobber
  Do not delete this asset: every web deploy depends on it."
fi

tar -xzf "$tmp/$asset" -C "$repo_root"

# The bundle can be stale — built before media was added, or uploaded truncated. Re-check rather than
# trusting that extraction was sufficient, so a bad bundle fails here instead of at render time.
still_missing=$(unmaterialized)

if [ -n "$still_missing" ]; then
  fail "bundle ${asset} did not satisfy the manifest — still unmaterialized:
$(printf '%s\n' "$still_missing" | sed 's/^/    /')
  Rebuild it from a checkout with the media present: bash scripts/ci/build-media-bundles.sh"
fi

echo "extracted web media into ${repo_root} (${total} assets verified)"
