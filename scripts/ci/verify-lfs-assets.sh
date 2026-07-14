#!/usr/bin/env bash
set -euo pipefail

repo_root=${REPO_ROOT:-$(git rev-parse --show-toplevel)}
manifest=${1:-scripts/ci/lfs-test-assets.txt}

case "$manifest" in
  /*) manifest_path=$manifest ;;
  *) manifest_path="$repo_root/$manifest" ;;
esac

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[[ -f $manifest_path ]] || fail "manifest does not exist: $manifest"

entries_file=$(mktemp "${TMPDIR:-/tmp}/verify-lfs-assets.XXXXXX")
trap 'rm -f "$entries_file"' EXIT

line_number=0
count=0

while IFS= read -r raw_line || [[ -n $raw_line ]]; do
  line_number=$((line_number + 1))
  entry=$(printf '%s\n' "$raw_line" | sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  [[ -n $entry ]] || continue

  case "$entry" in
    /* | .. | ../* | */../* | */..)
      fail "unsafe asset path on line $line_number: $entry"
      ;;
  esac

  if grep -Fqx -- "$entry" "$entries_file"; then
    fail "duplicate asset: $entry"
  fi

  printf '%s\n' "$entry" >> "$entries_file"
  count=$((count + 1))
done < "$manifest_path"

[[ $count -gt 0 ]] || fail 'manifest has no asset entries'

while IFS= read -r entry; do
  asset_path="$repo_root/$entry"
  [[ -f $asset_path ]] || fail "asset does not exist: $entry"

  attribute=$(git -C "$repo_root" check-attr filter -- "$entry")
  [[ $attribute == *': filter: lfs' ]] || fail "asset is not tracked by Git LFS: $entry"

  first_line=''
  IFS= read -r first_line < "$asset_path" || true
  if [[ $first_line == 'version https://git-lfs.github.com/spec/v1' ]]; then
    fail "asset is still an LFS pointer: $entry"
  fi
done < "$entries_file"

printf 'verified %d materialized Git LFS assets\n' "$count"
