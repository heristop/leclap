#!/usr/bin/env bash
set -euo pipefail

# Publishes the media bundles to the R2 bucket CI and the Cloudflare web build fetch from.
#
#   bash scripts/ci/publish-media-bundles.sh [web|test]
#
# Each bundle is uploaded twice: to bundles/<digest>/ where <digest> identifies its manifest (this is
# what the fetchers resolve, so it is immutable and safe to cache forever), and to bundles/latest/ as
# a convenience pointer for humans. Run it from a checkout where the media is materialized — the
# bundles are always rebuilt first, so what is uploaded is what the tree currently holds.
#
# Requires `wrangler login` (or CLOUDFLARE_API_TOKEN) with R2 write access on the account.
#
# Environment:
#   MEDIA_R2_BUCKET    bucket name. Defaults to leclap-media.
#   MEDIA_R2_ORIGIN    public origin, used to verify the upload over HTTPS. Defaults to the value
#                      compiled into media-bundle.sh.
#   CI_MEDIA_OUT_DIR   where build-media-bundles.sh writes. Defaults to dist/ci-media.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
out_dir="${CI_MEDIA_OUT_DIR:-$repo_root/dist/ci-media}"
bucket="${MEDIA_R2_BUCKET:-leclap-media}"
only="${1:-all}"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

wrangler() {
  npx --yes wrangler@4 "$@"
}

publish_bundle() {
  local asset=$1 manifest=$2
  local manifest_path="$repo_root/$manifest"
  local file="$out_dir/$asset"

  [ -f "$manifest_path" ] || fail "manifest not found: $manifest"
  [ -f "$file" ] || fail "bundle not built: $file
  Run: bash scripts/ci/build-media-bundles.sh"

  local digest
  digest=$(media_manifest_digest "$manifest_path")

  echo
  echo "publishing ${asset} (manifest digest ${digest}, $(du -h "$file" | cut -f1))"

  # --remote is not optional: without it wrangler writes to local simulated storage and reports
  # success, which looks identical here and 404s in CI.
  wrangler r2 object put "${bucket}/bundles/${digest}/${asset}" \
    --file "$file" --content-type application/gzip \
    --cache-control 'public, max-age=31536000, immutable' --remote ||
    fail "upload failed for bundles/${digest}/${asset}"

  wrangler r2 object put "${bucket}/bundles/latest/${asset}" \
    --file "$file" --content-type application/gzip \
    --cache-control 'public, max-age=300' --remote ||
    fail "upload failed for bundles/latest/${asset}"

  if [ -z "$MEDIA_R2_ORIGIN" ]; then
    echo "  uploaded to bundles/${digest}/ and bundles/latest/ (set MEDIA_R2_ORIGIN to verify over HTTPS)"
    return 0
  fi

  # Read it back the way CI will. An upload that succeeded but is not publicly readable — the bucket's
  # dev URL never enabled, say — otherwise only surfaces as a red CI run later.
  local url tmp actual expected
  url="${MEDIA_R2_ORIGIN%/}/bundles/${digest}/${asset}"
  tmp=$(mktemp "${TMPDIR:-/tmp}/publish-check.XXXXXX")

  curl -fsSL --retry 3 --retry-delay 2 -o "$tmp" "$url" || {
    rm -f "$tmp"
    fail "uploaded, but ${url} is not publicly readable.
  Enable the bucket's public dev URL: npx wrangler r2 bucket dev-url enable ${bucket}"
  }

  expected=$(media_sha256 "$file")
  actual=$(media_sha256 "$tmp")
  rm -f "$tmp"

  [ "$expected" = "$actual" ] || fail "${url} served $actual, expected $expected"

  echo "  verified ${url}"
}

echo "building bundles before publishing"
bash "$script_dir/build-media-bundles.sh" "$only"

case "$only" in
  all)
    publish_bundle 'web-media.tar.gz' 'scripts/ci/lfs-web-assets.txt'
    publish_bundle 'ci-test-media.tar.gz' 'scripts/ci/lfs-test-assets.txt'
    ;;
  web) publish_bundle 'web-media.tar.gz' 'scripts/ci/lfs-web-assets.txt' ;;
  test) publish_bundle 'ci-test-media.tar.gz' 'scripts/ci/lfs-test-assets.txt' ;;
  *) fail "unknown bundle: $only (expected 'web', 'test' or no argument)" ;;
esac

echo
echo "done. CI and the web build resolve these URLs from the committed manifests — no variable to update."
