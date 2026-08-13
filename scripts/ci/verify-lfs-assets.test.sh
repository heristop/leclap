#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
validator="$script_dir/verify-lfs-assets.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

repo="$tmp_dir/repo"
git init -q "$repo"

cat > "$repo/.gitattributes" <<'EOF'
*.mp4 filter=lfs diff=lfs merge=lfs -text
EOF

printf 'materialized media\n' > "$repo/clip.mp4"
printf 'ordinary file\n' > "$repo/plain.txt"
cat > "$repo/pointer.mp4" <<'EOF'
version https://git-lfs.github.com/spec/v1
oid sha256:0000000000000000000000000000000000000000000000000000000000000000
size 42
EOF

run_validator() {
  local manifest=$1

  REPO_ROOT="$repo" bash "$validator" "$manifest"
}

expect_failure() {
  local name=$1
  local manifest=$2
  local expected=$3
  local output
  local status

  set +e
  output=$(run_validator "$manifest" 2>&1)
  status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    printf 'FAIL %s: validator unexpectedly succeeded\n' "$name" >&2
    exit 1
  fi

  if [[ $output != *"$expected"* ]]; then
    printf 'FAIL %s: expected output containing %q, got:\n%s\n' "$name" "$expected" "$output" >&2
    exit 1
  fi
}

clip_sha=$(media_sha256 "$repo/clip.mp4")
plain_sha=$(media_sha256 "$repo/plain.txt")
pointer_sha=$(media_sha256 "$repo/pointer.mp4")

valid_manifest="$tmp_dir/valid.txt"
cat > "$valid_manifest" <<EOF
# inline comments and surrounding whitespace are normalized
  $clip_sha  clip.mp4  # required clip
EOF

valid_output=$(run_validator "$valid_manifest")
[[ $valid_output == 'verified 1 materialized Git LFS assets (content matches manifest)' ]]

empty_manifest="$tmp_dir/empty.txt"
printf '# comments only\n\n' > "$empty_manifest"
expect_failure 'empty manifest' "$empty_manifest" 'manifest has no asset entries'

duplicate_manifest="$tmp_dir/duplicate.txt"
printf '%s  clip.mp4\n%s  clip.mp4\n' "$clip_sha" "$clip_sha" > "$duplicate_manifest"
expect_failure 'duplicate entry' "$duplicate_manifest" 'duplicate asset: clip.mp4'

parent_manifest="$tmp_dir/parent.txt"
printf '%s  ../clip.mp4\n' "$clip_sha" > "$parent_manifest"
expect_failure 'parent path' "$parent_manifest" 'unsafe asset path on line 1: ../clip.mp4'

absolute_manifest="$tmp_dir/absolute.txt"
printf '%s  /clip.mp4\n' "$clip_sha" > "$absolute_manifest"
expect_failure 'absolute path' "$absolute_manifest" 'unsafe asset path on line 1: /clip.mp4'

missing_manifest="$tmp_dir/missing.txt"
printf '%s  missing.mp4\n' "$clip_sha" > "$missing_manifest"
expect_failure 'missing file' "$missing_manifest" 'asset does not exist: missing.mp4'

untracked_manifest="$tmp_dir/untracked.txt"
printf '%s  plain.txt\n' "$plain_sha" > "$untracked_manifest"
expect_failure 'non-lfs file' "$untracked_manifest" 'asset is not tracked by Git LFS: plain.txt'

pointer_manifest="$tmp_dir/pointer.txt"
printf '%s  pointer.mp4\n' "$pointer_sha" > "$pointer_manifest"
expect_failure 'pointer file' "$pointer_manifest" 'asset is still an LFS pointer: pointer.mp4'

# The content check is the new guarantee: a manifest can be structurally perfect and still describe
# media the tree does not actually contain.
stale_manifest="$tmp_dir/stale.txt"
printf '%064d  clip.mp4\n' 0 > "$stale_manifest"
expect_failure 'content mismatch' "$stale_manifest" 'clip.mp4: expected'

undigested_manifest="$tmp_dir/undigested.txt"
printf 'clip.mp4\n' > "$undigested_manifest"
expect_failure 'missing digest' "$undigested_manifest" 'no digest recorded'

printf 'all verify-lfs-assets tests passed\n'
