#!/usr/bin/env bash

# Shared manifest and bundle handling for the media pipeline. Sourced by fetch-{web,test}-media.sh,
# build-media-bundles.sh, publish-media-bundles.sh and verify-lfs-assets.sh — everything that has to
# agree on what a manifest means and where a bundle lives.
#
# This repo's media cannot be fetched through Git LFS (the budget is exhausted; downloads return 403
# and `git lfs pull` exits 0 while materializing nothing), so it ships as tarballs on object storage.
#
# Manifest format — one asset per line, `#` comments and surrounding whitespace ignored:
#
#     <sha256>  <repo-relative-path>
#
# The two-column form is sha256sum-compatible. Single-column (path only) manifests still parse, for
# fixtures and for reading history, but they cannot be content-verified — media_verify_digests treats
# a missing digest as an error rather than passing silently.
#
# Bundles are addressed by the digest of their manifest, so a checkout resolves its own pinned URL and
# nothing has to be edited in a dashboard when media changes. Because the manifest carries each asset's
# SHA-256, that digest covers content, not just paths.

# Public origin of the leclap-media R2 bucket. This is the bucket's r2.dev development URL, which
# Cloudflare documents as rate-limited and "for development purposes" — an interim while the media
# proves itself here. The end state is a custom domain (media.leclap.dev); switching is this one
# string. Sustained 429s from CI are the signal to make that move, not a bug in the fetchers.
# Set empty to fall back to the GitHub Release; set CI_MEDIA_BASE_URL to override the prefix outright.
# `=` not `:=` — the latter also substitutes for an *empty* value, which would make "set it empty to
# fall back" quietly impossible and leave the release path unreachable.
: "${MEDIA_R2_ORIGIN=https://pub-82f4f34fee63405f8cb16daab4344642.r2.dev}"

MEDIA_LFS_POINTER='version https://git-lfs.github.com/spec/v1'

media_fail() {
  printf 'error: %s\n' "$1" >&2
  return 1
}

# macOS runners have shasum but no sha256sum; Linux runners have both.
media_sha256() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
    return
  fi
  shasum -a 256 "$1" | cut -d' ' -f1
}

# Manifest lines with comments and surrounding whitespace stripped, blanks dropped. Column separation
# is normalized to two spaces so the output is stable input for hashing and for `sha256sum -c`.
media_manifest_entries() {
  sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/[[:space:]][[:space:]]*/  /g' \
    "$1" | grep -v '^$' || true
}

# The path column alone. build-media-bundles.sh feeds this to `tar -T`, which needs bare paths.
media_manifest_paths() {
  media_manifest_entries "$1" | sed -e 's/^[0-9a-f]\{64\}  //'
}

# The digest recorded for one path, empty when the manifest predates the two-column format.
media_manifest_digest_for() {
  media_manifest_entries "$1" | awk -v want="$2" '
    NF == 2 && $2 == want { print $1; exit }
  '
}

# Identifies the bundle built from this manifest. Entries are sorted before hashing so reordering or
# recommenting a manifest does not orphan a published bundle; only the asset set and its content move it.
media_manifest_digest() {
  media_manifest_entries "$1" | LC_ALL=C sort | media_sha256 /dev/stdin | cut -c1-12
}

# Assets that are absent or still LFS pointer files, one per line. Empty output means the tree is whole.
media_unmaterialized() {
  local manifest=$1 root=$2 path first

  while IFS= read -r path; do
    if [ ! -f "$root/$path" ]; then
      printf '%s\n' "$path"
      continue
    fi

    first=''
    IFS= read -r first < "$root/$path" || true
    [ "$first" = "$MEDIA_LFS_POINTER" ] && printf '%s\n' "$path"
  done < <(media_manifest_paths "$manifest")

  return 0
}

# Verifies asset content against the manifest. With no path arguments every entry is checked; passing
# paths scopes the check to them, which is what the Rust CI job needs after extracting one member.
#
# A bundle that is truncated, stale, or built from a different revision extracts cleanly and passes the
# not-a-pointer heuristic. This is the check that catches it, before FFmpeg turns it into a decode error.
media_verify_digests() {
  local manifest=$1 root=$2
  shift 2

  local scope='' path expected actual problems='' checked=0

  if [ "$#" -gt 0 ]; then
    scope=$(printf '%s\n' "$@")
  fi

  while IFS= read -r path; do
    if [ -n "$scope" ] && ! printf '%s\n' "$scope" | grep -Fqx -- "$path"; then
      continue
    fi

    checked=$((checked + 1))
    expected=$(media_manifest_digest_for "$manifest" "$path")

    if [ -z "$expected" ]; then
      problems+="    $path: no digest recorded in the manifest"$'\n'
      continue
    fi

    if [ ! -f "$root/$path" ]; then
      problems+="    $path: missing"$'\n'
      continue
    fi

    actual=$(media_sha256 "$root/$path")
    [ "$actual" = "$expected" ] && continue
    problems+="    $path: expected $expected, got $actual"$'\n'
  done < <(media_manifest_paths "$manifest")

  if [ -n "$problems" ]; then
    media_fail "media does not match the manifest:
${problems%$'\n'}"
    return 1
  fi

  [ "$checked" -gt 0 ] || media_fail "no manifest entries matched the requested paths" || return 1

  return 0
}

# Where a bundle lives. CI_MEDIA_BASE_URL overrides the whole prefix and is used verbatim, which is how
# rollback to the GitHub Release (a flat layout, no digest segment) keeps working.
media_bundle_url() {
  local manifest=$1 asset=$2

  if [ -n "${CI_MEDIA_BASE_URL:-}" ]; then
    printf '%s/%s\n' "${CI_MEDIA_BASE_URL%/}" "$asset"
    return
  fi

  if [ -n "$MEDIA_R2_ORIGIN" ]; then
    printf '%s/bundles/%s/%s\n' "${MEDIA_R2_ORIGIN%/}" "$(media_manifest_digest "$manifest")" "$asset"
    return
  fi

  printf 'https://github.com/heristop/leclap/releases/download/%s/%s\n' "${CI_MEDIA_TAG:-ci-assets-v1}" "$asset"
}
