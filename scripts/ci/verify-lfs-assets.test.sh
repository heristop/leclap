#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
validator="$script_dir/verify-lfs-assets.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

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

valid_manifest="$tmp_dir/valid.txt"
cat > "$valid_manifest" <<'EOF'
# inline comments and surrounding whitespace are normalized
  clip.mp4  # required clip
EOF

valid_output=$(run_validator "$valid_manifest")
[[ $valid_output == 'verified 1 materialized Git LFS assets' ]]

empty_manifest="$tmp_dir/empty.txt"
printf '# comments only\n\n' > "$empty_manifest"
expect_failure 'empty manifest' "$empty_manifest" 'manifest has no asset entries'

duplicate_manifest="$tmp_dir/duplicate.txt"
printf 'clip.mp4\nclip.mp4\n' > "$duplicate_manifest"
expect_failure 'duplicate entry' "$duplicate_manifest" 'duplicate asset: clip.mp4'

parent_manifest="$tmp_dir/parent.txt"
printf '../clip.mp4\n' > "$parent_manifest"
expect_failure 'parent path' "$parent_manifest" 'unsafe asset path on line 1: ../clip.mp4'

absolute_manifest="$tmp_dir/absolute.txt"
printf '/clip.mp4\n' > "$absolute_manifest"
expect_failure 'absolute path' "$absolute_manifest" 'unsafe asset path on line 1: /clip.mp4'

missing_manifest="$tmp_dir/missing.txt"
printf 'missing.mp4\n' > "$missing_manifest"
expect_failure 'missing file' "$missing_manifest" 'asset does not exist: missing.mp4'

untracked_manifest="$tmp_dir/untracked.txt"
printf 'plain.txt\n' > "$untracked_manifest"
expect_failure 'non-lfs file' "$untracked_manifest" 'asset is not tracked by Git LFS: plain.txt'

pointer_manifest="$tmp_dir/pointer.txt"
printf 'pointer.mp4\n' > "$pointer_manifest"
expect_failure 'pointer file' "$pointer_manifest" 'asset is still an LFS pointer: pointer.mp4'

printf 'all verify-lfs-assets tests passed\n'
