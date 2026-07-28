#!/usr/bin/env bash
set -euo pipefail

# Covers the guard that failed us in practice: the fetcher used to decide "already materialized" from
# a single sentinel file, so a checkout where only *some* media was real passed straight through and
# the build shipped LFS pointer files as videos. These tests drive the script against a fake bundle
# served from disk (CI_MEDIA_BASE_URL is a file:// URL) so nothing here touches the network.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fetcher="$script_dir/fetch-web-media.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

pointer() {
  printf 'version https://git-lfs.github.com/spec/v1\noid sha256:%064d\nsize 4\n' 0
}

manifest="$tmp_dir/manifest.txt"
cat > "$manifest" <<'EOF'
# two clips, one sound
media/a.mp4
media/b.mp4   # inline comment
media/c.mp3
EOF

# The "release": a tarball holding real bytes for every manifest entry.
bundle_root="$tmp_dir/bundle-src"
mkdir -p "$bundle_root/media"
for f in a.mp4 b.mp4 c.mp3; do printf 'real bytes for %s\n' "$f" > "$bundle_root/media/$f"; done
serve_dir="$tmp_dir/serve"
mkdir -p "$serve_dir"
tar -czf "$serve_dir/web-media.tar.gz" -C "$bundle_root" media

make_repo() { # $1 = dir, $2... = files that should be LFS pointers rather than real
  local dir=$1; shift
  rm -rf "$dir"; mkdir -p "$dir/media"
  for f in a.mp4 b.mp4 c.mp3; do printf 'real bytes for %s\n' "$f" > "$dir/media/$f"; done
  for f in "$@"; do pointer > "$dir/media/$f"; done
}

run() { # $1 = repo root
  REPO_ROOT="$1" CI_MEDIA_MANIFEST="$manifest" CI_MEDIA_BASE_URL="file://$serve_dir" bash "$fetcher" 2>&1
}

fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

# 1. Everything already real → no download, exits 0.
repo="$tmp_dir/repo-complete"
make_repo "$repo"
out=$(run "$repo") || fail 'complete checkout should succeed'
[[ $out == *'already materialized'* ]] || fail "complete checkout should skip the fetch, got: $out"

# 2. THE REGRESSION: only one file is a pointer. The old single-sentinel check skipped here.
repo="$tmp_dir/repo-partial"
make_repo "$repo" b.mp4
out=$(run "$repo") || fail "partial checkout should self-heal, got: $out"
[[ $out != *'already materialized'* ]] || fail 'partial checkout must NOT skip the fetch'
grep -q 'real bytes for b.mp4' "$repo/media/b.mp4" || fail 'partial checkout did not get real bytes'

# 3. A fully pointer-ised checkout (what GIT_LFS_SKIP_SMUDGE=1 produces) is filled in.
repo="$tmp_dir/repo-pointers"
make_repo "$repo" a.mp4 b.mp4 c.mp3
run "$repo" > /dev/null || fail 'pointer checkout should be filled from the bundle'
for f in a.mp4 b.mp4 c.mp3; do
  grep -q "real bytes for $f" "$repo/media/$f" || fail "$f was not materialized"
done

# 4. Missing bundle → non-zero exit and an error naming the rebuild path, not a silent pass.
repo="$tmp_dir/repo-nobundle"
make_repo "$repo" a.mp4
set +e
out=$(REPO_ROOT="$repo" CI_MEDIA_MANIFEST="$manifest" CI_MEDIA_BASE_URL="file://$tmp_dir/nowhere" bash "$fetcher" 2>&1)
status=$?
set -e
[[ $status -ne 0 ]] || fail 'missing bundle must fail the build'
[[ $out == *'build-media-bundles.sh'* ]] || fail "missing-bundle error should say how to rebuild, got: $out"

# 5. A bundle that does not satisfy the manifest fails loudly instead of leaving pointers behind.
short_serve="$tmp_dir/serve-short"
mkdir -p "$short_serve" "$tmp_dir/short-src/media"
printf 'real bytes for a.mp4\n' > "$tmp_dir/short-src/media/a.mp4"
tar -czf "$short_serve/web-media.tar.gz" -C "$tmp_dir/short-src" media
repo="$tmp_dir/repo-short"
make_repo "$repo" a.mp4 b.mp4
set +e
out=$(REPO_ROOT="$repo" CI_MEDIA_MANIFEST="$manifest" CI_MEDIA_BASE_URL="file://$short_serve" bash "$fetcher" 2>&1)
status=$?
set -e
[[ $status -ne 0 ]] || fail 'incomplete bundle must fail the build'
[[ $out == *'media/b.mp4'* ]] || fail "error should name the unsatisfied asset, got: $out"

printf 'all fetch-web-media tests passed\n'
