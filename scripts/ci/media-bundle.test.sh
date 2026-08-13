#!/usr/bin/env bash
set -euo pipefail

# Covers the shared manifest/bundle library the fetchers, the bundler and the validator all source.
# The behaviour worth pinning down here is content verification: until now a bundle was trusted once
# it extracted and its files did not start with an LFS pointer header, so a truncated or stale bundle
# passed and surfaced later as an opaque FFmpeg decode error. Digests close that. Nothing here touches
# the network.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

pointer() {
  printf 'version https://git-lfs.github.com/spec/v1\noid sha256:%064d\nsize 4\n' 0
}

# A repo with three real assets.
repo="$tmp_dir/repo"
mkdir -p "$repo/media"
for f in a.mp4 b.mp4 c.mp3; do printf 'real bytes for %s\n' "$f" > "$repo/media/$f"; done

sha_a=$(media_sha256 "$repo/media/a.mp4")
sha_b=$(media_sha256 "$repo/media/b.mp4")
sha_c=$(media_sha256 "$repo/media/c.mp3")

[[ ${#sha_a} -eq 64 ]] || fail "media_sha256 should emit a bare 64-char hex digest, got: $sha_a"

manifest="$tmp_dir/manifest.txt"
cat > "$manifest" <<EOF
# two clips, one sound
$sha_a  media/a.mp4
$sha_b  media/b.mp4   # inline comment
$sha_c  media/c.mp3
EOF

# --- parsing -----------------------------------------------------------------------------------

paths=$(media_manifest_paths "$manifest")
[[ $paths == 'media/a.mp4
media/b.mp4
media/c.mp3' ]] || fail "media_manifest_paths should yield bare paths, got: $paths"

# build-media-bundles.sh feeds this straight to `tar -T`, so a stray digest column would break it.
legacy="$tmp_dir/legacy.txt"
printf '# no digests yet\nmedia/a.mp4  # trailing\n' > "$legacy"
[[ $(media_manifest_paths "$legacy") == 'media/a.mp4' ]] || fail 'single-column manifests must still parse'

# --- digest pinning ----------------------------------------------------------------------------

digest=$(media_manifest_digest "$manifest")
[[ ${#digest} -eq 12 ]] || fail "media_manifest_digest should be 12 chars, got: $digest"

# Cosmetic edits must not move the bundle URL, or every comment fix orphans the published bundle.
cosmetic="$tmp_dir/cosmetic.txt"
cat > "$cosmetic" <<EOF

# a completely different comment
   $sha_c  media/c.mp3
$sha_a       media/a.mp4
$sha_b  media/b.mp4
EOF
[[ $(media_manifest_digest "$cosmetic") == "$digest" ]] ||
  fail 'digest must be stable across comments, whitespace and ordering'

# A changed asset must move the URL: that is the whole point of pinning.
changed="$tmp_dir/changed.txt"
sed "s/$sha_b/${sha_b:0:63}0/" "$manifest" > "$changed"
[[ $(media_manifest_digest "$changed") != "$digest" ]] || fail 'digest must change when an asset changes'

# --- content verification ------------------------------------------------------------------------

media_verify_digests "$manifest" "$repo" || fail 'a matching tree should verify'

corrupt="$tmp_dir/repo-corrupt"
cp -R "$repo" "$corrupt"
printf 'truncated' > "$corrupt/media/b.mp4"
set +e
out=$(media_verify_digests "$manifest" "$corrupt" 2>&1); status=$?
set -e
[[ $status -ne 0 ]] || fail 'corrupted content must fail verification'
[[ $out == *'media/b.mp4'* ]] || fail "verification failure should name the asset, got: $out"
[[ $out != *'media/a.mp4'* ]] || fail "verification should not blame intact assets, got: $out"

# The Rust job extracts a single member, so verification has to be scopeable to it.
media_verify_digests "$manifest" "$corrupt" media/a.mp4 media/c.mp3 ||
  fail 'scoped verification should ignore assets outside the requested paths'
set +e
media_verify_digests "$manifest" "$corrupt" media/b.mp4 >/dev/null 2>&1; status=$?
set -e
[[ $status -ne 0 ]] || fail 'scoped verification must still catch a corrupt requested asset'

# An entry with no digest cannot be verified — that must be an error, not a silent pass.
set +e
out=$(media_verify_digests "$legacy" "$repo" 2>&1); status=$?
set -e
[[ $status -ne 0 ]] || fail 'an undigested entry must not silently pass verification'
[[ $out == *'no digest'* ]] || fail "undigested entry should say so, got: $out"

# --- materialization check -------------------------------------------------------------------------

[[ -z $(media_unmaterialized "$manifest" "$repo") ]] || fail 'complete tree should report nothing missing'

partial="$tmp_dir/repo-partial"
cp -R "$repo" "$partial"
pointer > "$partial/media/b.mp4"
rm "$partial/media/c.mp3"
missing=$(media_unmaterialized "$manifest" "$partial")
[[ $missing == *'media/b.mp4'* ]] || fail "pointer file should count as unmaterialized, got: $missing"
[[ $missing == *'media/c.mp3'* ]] || fail "absent file should count as unmaterialized, got: $missing"
[[ $missing != *'media/a.mp4'* ]] || fail "real file should not be listed, got: $missing"

# --- URL resolution -------------------------------------------------------------------------------

# An explicit base URL wins outright and stays flat, so rollback to the GitHub Release keeps working.
url=$(CI_MEDIA_BASE_URL='file:///tmp/serve' media_bundle_url "$manifest" web-media.tar.gz)
[[ $url == 'file:///tmp/serve/web-media.tar.gz' ]] || fail "override should be used verbatim, got: $url"

# With no override, the R2 origin is pinned by the manifest digest.
url=$(CI_MEDIA_BASE_URL='' MEDIA_R2_ORIGIN='https://pub-test.r2.dev' media_bundle_url "$manifest" web-media.tar.gz)
[[ $url == "https://pub-test.r2.dev/bundles/$digest/web-media.tar.gz" ]] ||
  fail "default should pin to the manifest digest, got: $url"

# Emptying the origin falls back to the GitHub Release. This MUST run in a fresh shell: setting the
# variable in an already-sourced shell tests the function, not the sourcing, and the file's default
# assignment is exactly where an empty value can get silently overwritten (`:=` instead of `=`).
url=$(MEDIA_R2_ORIGIN='' CI_MEDIA_BASE_URL='' bash -c \
  "source '$script_dir/media-bundle.sh'; media_bundle_url '$manifest' web-media.tar.gz")
[[ $url == *'/releases/download/'* ]] ||
  fail "an empty MEDIA_R2_ORIGIN must fall back to the release, got: $url"

# ...and the default must still apply when the variable is genuinely absent.
url=$(env -u MEDIA_R2_ORIGIN -u CI_MEDIA_BASE_URL bash -c \
  "source '$script_dir/media-bundle.sh'; media_bundle_url '$manifest' web-media.tar.gz")
[[ $url == *'.r2.dev/bundles/'* ]] || fail "an unset origin should use the R2 default, got: $url"

printf 'all media-bundle tests passed\n'
