#!/usr/bin/env bash
set -euo pipefail

# Rebuilds the media bundles that CI and the Cloudflare web build download instead of pulling Git LFS
# (this repo's LFS budget is exhausted — downloads return 403). Both bundles are built from their
# committed manifests, so what ships is always exactly what the consumers verify against:
#
#   web-media.tar.gz      scripts/ci/lfs-web-assets.txt   → apps/leclap-web build (fetch-web-media.sh)
#   ci-test-media.tar.gz  scripts/ci/lfs-test-assets.txt  → GitHub Actions (fetch-test-media.sh)
#
# Run from a checkout where the media is materialized (not LFS pointers), then publish the output.
#
#   bash scripts/ci/build-media-bundles.sh [web|test]
#   bash scripts/ci/publish-media-bundles.sh
#
# The bundles are the only surviving copy of this media while LFS is over budget — rebuild from a
# tree you trust, and check the manifest drift warning below before uploading.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
out_dir="${CI_MEDIA_OUT_DIR:-$repo_root/dist/ci-media}"
lfs_pointer="$MEDIA_LFS_POINTER"
only="${1:-all}"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

# Deliberately not local, and the trap is set once here: every `fail` below exits straight past any
# cleanup, and a function-local would be out of scope by the time an EXIT trap ran.
media_bundle_list=''
trap 'rm -f "$media_bundle_list"' EXIT

# Refuse to bundle a pointer file: a bundle built from a partial checkout looks valid to tar and then
# fails at render time, which is exactly the failure mode these bundles exist to prevent.
build_bundle() {
  local name=$1 manifest=$2
  local manifest_path="$repo_root/$manifest"

  [ -f "$manifest_path" ] || fail "manifest not found: $manifest"

  local count
  media_bundle_list=$(mktemp "${TMPDIR:-/tmp}/media-bundle.XXXXXX")
  local list=$media_bundle_list
  # Bare paths only: this file is handed to `tar -T`, which would treat a digest column as a filename.
  media_manifest_paths "$manifest_path" > "$list"
  count=$(grep -c '' < "$list" || true)
  [ "$count" -gt 0 ] || fail "manifest has no entries: $manifest"

  local entry first
  while IFS= read -r entry; do
    [ -f "$repo_root/$entry" ] || fail "missing asset (cannot bundle): $entry"

    first=''
    IFS= read -r first < "$repo_root/$entry" || true
    [ "$first" = "$lfs_pointer" ] && fail "asset is still an LFS pointer (cannot bundle): $entry"
  done < "$list"

  mkdir -p "$out_dir"
  # COPYFILE_DISABLE stops macOS tar from embedding ._AppleDouble members that pollute the checkout.
  # gzip -n omits the timestamp gzip would otherwise stamp into its header, so rebuilding unchanged
  # media yields an identical file and "did the bundle actually change?" has an answer. (Byte-identity
  # holds per machine; tar implementations differ. Correctness never rests on it — the manifest's
  # per-asset digests do.)
  COPYFILE_DISABLE=1 tar --exclude='.DS_Store' --exclude='._*' -cf - -C "$repo_root" -T "$list" \
    | gzip -n > "$out_dir/$name"
  rm -f "$list"
  media_bundle_list=''

  printf '  %-22s %s assets  %s\n' "$name" "$count" "$(du -h "$out_dir/$name" | cut -f1)"
}

# The web manifest should list every LFS asset under the trees the web build consumes. Adding media
# without updating it would produce a bundle that silently omits the new file, so warn loudly here —
# the fetcher's post-extract check would otherwise only surface it during a deploy.
warn_web_manifest_drift() {
  command -v git >/dev/null || return 0
  git -C "$repo_root" lfs ls-files -n >/dev/null 2>&1 || return 0

  local expected actual
  expected=$(git -C "$repo_root" lfs ls-files -n \
    | grep -E '^(packages/leclap-creative-kit/src/library/|apps/leclap-web/public/videos/)' | sort)
  actual=$(media_manifest_paths "$repo_root/scripts/ci/lfs-web-assets.txt" | sort)

  [ "$expected" = "$actual" ] && return 0

  printf '\nwarning: scripts/ci/lfs-web-assets.txt has drifted from git lfs ls-files\n' >&2
  diff <(printf '%s\n' "$actual") <(printf '%s\n' "$expected") | sed 's/^/  /' >&2
  printf '  (< manifest, > tracked in LFS) — update the manifest before uploading.\n\n' >&2
}

echo "building media bundles into ${out_dir}"

case "$only" in
  all)
    warn_web_manifest_drift
    build_bundle 'web-media.tar.gz' 'scripts/ci/lfs-web-assets.txt'
    build_bundle 'ci-test-media.tar.gz' 'scripts/ci/lfs-test-assets.txt'
    ;;
  web)
    warn_web_manifest_drift
    build_bundle 'web-media.tar.gz' 'scripts/ci/lfs-web-assets.txt'
    ;;
  test)
    build_bundle 'ci-test-media.tar.gz' 'scripts/ci/lfs-test-assets.txt'
    ;;
  *)
    fail "unknown bundle: $only (expected 'web', 'test' or no argument)"
    ;;
esac

echo
echo "publish with:"
echo "  bash scripts/ci/publish-media-bundles.sh"
