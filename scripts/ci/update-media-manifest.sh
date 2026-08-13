#!/usr/bin/env bash
set -euo pipefail

# Rewrites a media manifest's SHA-256 column from the working tree, preserving comments and ordering.
# Run it from a checkout where the media is materialized, after adding, removing or replacing an asset,
# then rebuild and publish the bundles — the digest of this file is what addresses them.
#
#   bash scripts/ci/update-media-manifest.sh [manifest ...]
#
# With no arguments both committed manifests are updated. Refuses to record the hash of an LFS pointer,
# which would otherwise pin the bundle to a digest no real asset can ever match.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

# Deliberately not local, and the trap is set once here: every `fail` below exits straight past any
# cleanup, and a function-local would be out of scope by the time an EXIT trap ran.
media_manifest_tmp=''
trap 'rm -f "$media_manifest_tmp"' EXIT

update_manifest() {
  local manifest=$1
  local manifest_path="$repo_root/$manifest"

  case "$manifest" in
    /*) manifest_path=$manifest ;;
  esac

  [ -f "$manifest_path" ] || fail "manifest not found: $manifest"

  local before after
  before=$(media_manifest_digest "$manifest_path")

  media_manifest_tmp=$(mktemp "${TMPDIR:-/tmp}/media-manifest.XXXXXX")
  local out=$media_manifest_tmp

  local raw entry note path first sha count=0
  while IFS= read -r raw || [ -n "$raw" ]; do
    entry=$(printf '%s\n' "$raw" | sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    if [ -z "$entry" ]; then
      printf '%s\n' "$raw" >> "$out"
      continue
    fi

    # An asset line may carry a trailing note. Carry it across: silently dropping annotations on a
    # routine rehash is the kind of edit nobody notices until the explanation is gone.
    note=''
    case "$raw" in
      *'#'*) note=$(printf '%s\n' "$raw" | sed -e 's/^[^#]*#/#/') ;;
    esac

    path=$(printf '%s\n' "$entry" | sed -e 's/^[0-9a-f]\{64\}[[:space:]][[:space:]]*//')
    [ -f "$repo_root/$path" ] || fail "missing asset (cannot hash): $path"

    first=''
    IFS= read -r first < "$repo_root/$path" || true
    [ "$first" = "$MEDIA_LFS_POINTER" ] && fail "asset is still an LFS pointer (cannot hash): $path"

    sha=$(media_sha256 "$repo_root/$path")
    if [ -n "$note" ]; then
      printf '%s  %s  %s\n' "$sha" "$path" "$note" >> "$out"
    else
      printf '%s  %s\n' "$sha" "$path" >> "$out"
    fi
    count=$((count + 1))
  done < "$manifest_path"

  [ "$count" -gt 0 ] || fail "manifest has no asset entries: $manifest"

  # Write through rather than mv: mktemp creates 0600, and moving it over the manifest would silently
  # strip its committed 0644 mode.
  cat "$out" > "$manifest_path"
  rm -f "$out"
  media_manifest_tmp=''
  after=$(media_manifest_digest "$manifest_path")

  printf '  %-34s %s assets  digest %s' "$(basename "$manifest")" "$count" "$after"
  [ "$before" = "$after" ] && printf ' (unchanged)\n' || printf ' (was %s — republish bundles)\n' "$before"
}

manifests=("$@")
if [ "${#manifests[@]}" -eq 0 ]; then
  manifests=(scripts/ci/lfs-web-assets.txt scripts/ci/lfs-test-assets.txt)
fi

echo "updating media manifests from ${repo_root}"
for manifest in "${manifests[@]}"; do
  update_manifest "$manifest"
done
