#!/usr/bin/env bash
set -euo pipefail

# Covers the rule that scripts/ci/lfs-web-assets.txt lists exactly the Git LFS assets the web build
# ships. e50fd210 deleted ten landing videos and left their lines behind; fetch-web-media.sh extracts
# the whole bundle that manifest addresses, so every Cloudflare Pages build re-created the deleted files
# and deployed them. The only guard was a warning printed when someone rebuilt the bundles, so nothing
# in CI noticed. check-web-manifest-drift.sh now fails CI on it, and build-media-bundles.sh refuses to
# bundle from a drifted manifest through the same check. The fixture is a throwaway repo of LFS pointer
# blobs; nothing here touches the network.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
checker="$script_dir/check-web-manifest-drift.sh"
builder="$script_dir/build-media-bundles.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

git lfs version > /dev/null 2>&1 || fail 'git-lfs is required: the check lists assets with git lfs ls-files'

# Inherited from a git hook, these would aim every `git -C "$repo"` below at the enclosing repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_COMMON_DIR

kit=packages/leclap-creative-kit/src/library
web=apps/leclap-web/public/videos

repo="$tmp_dir/repo"
manifest="$repo/scripts/ci/lfs-web-assets.txt"
git init -q "$repo"
mkdir -p "$repo/scripts/ci"

# git lfs ls-files recognizes an asset by its committed blob being a pointer, not by .gitattributes, so
# committed pointer text is a faithful fixture: no filter, no object store. Hashing the path into the
# oid keeps every pointer distinct.
add_pointers() { # $@ = repo-relative paths
  local path
  for path in "$@"; do
    mkdir -p "$(dirname "$repo/$path")"
    printf 'version https://git-lfs.github.com/spec/v1\noid sha256:%s\nsize 4\n' \
      "$(printf '%s' "$path" | media_sha256 /dev/stdin)" > "$repo/$path"
  done
}

# Identity, signing and hooks are pinned so the host's git config can neither fail nor divert a commit.
commit() { # $1 = message
  git -C "$repo" add -A
  git -C "$repo" -c user.name=fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false \
    -c core.hooksPath=/dev/null commit -q -m "$1"
}

# Written like the real manifest — digest column, trailing notes, comments — none of which may count.
write_manifest() { # $@ = paths to list
  local path
  {
    printf '# fixture web manifest\n\n# Creative-kit and web media\n'
    for path in "$@"; do printf '%064d  %s  # note\n' 0 "$path"; done
  } > "$manifest"
}

check() { REPO_ROOT="$repo" bash "$checker" 2>&1; }

# LFS media in both web trees, plus the two neighbours that must never be demanded: an LFS asset
# outside those trees, and a plain blob inside one (the landing films are committed that way).
add_pointers "$kit/musics/theme.mp3" "$web/promo.mp4" "$web/promo.webm" \
  packages/ffmpeg-engine/tests/fixtures/sample.mp4
mkdir -p "$repo/$web/films"
printf 'plain blob\n' > "$repo/$web/films/showcase.mp4"
commit 'media'

# --- agreement ---------------------------------------------------------------------------------------

# Out of order, with digests, notes and comments: only the set of paths is compared.
write_manifest "$web/promo.webm" "$kit/musics/theme.mp3" "$web/promo.mp4"
out=$(check) || fail "a manifest listing exactly the web LFS assets should pass, got: $out"

# --- the regression: media deleted, its line left behind ------------------------------------------

git -C "$repo" rm -q "$web/promo.webm"
commit 'drop the webm promo'

set +e
out=$(check); status=$?
set -e
[[ $status -ne 0 ]] || fail "a line whose media was deleted must fail the check, got: $out"
[[ $out == *"$web/promo.webm"* ]] || fail "the error should name the stale line, got: $out"
[[ $out != *"$web/promo.mp4"* && $out != *theme.mp3* ]] || fail "the error should not blame agreeing paths, got: $out"
[[ $out == *'git lfs ls-files -n'* ]] || fail "the error should point at the manifest-header procedure, got: $out"
[[ $out == *'publish-media-bundles.sh web'* ]] || fail "the error should say to republish the web bundle, got: $out"
[[ $out == *digest* ]] || fail "the error should say why: the fix moves the bundle's digest, got: $out"

# --- new media that never made the list -----------------------------------------------------------

add_pointers "$web/teaser.mp4"
commit 'add a teaser'

set +e
out=$(check); status=$?
set -e
[[ $status -ne 0 ]] || fail "an LFS asset the manifest omits must fail the check, got: $out"
# Both directions at once, each path under its own heading.
extra_heading='In the manifest but not in Git LFS'
missing_heading='In Git LFS but not in the manifest'
[[ $out == *"$extra_heading"*"$web/promo.webm"*"$missing_heading"*"$web/teaser.mp4"* ]] ||
  fail "the error should file each path under its direction, got: $out"

# The comparison itself, from the library the check and the bundler share.
drift=$(media_web_manifest_drift "$manifest" "$repo")
[[ $drift == "extra $web/promo.webm
missing $web/teaser.mp4" ]] || fail "media_web_manifest_drift should tag each side, got: $drift"

# Following the procedure — stale line deleted, new path added — makes it pass again.
write_manifest "$kit/musics/theme.mp3" "$web/promo.mp4" "$web/teaser.mp4"
out=$(check) || fail "a corrected manifest should pass, got: $out"

# --- nothing to compare against -----------------------------------------------------------------------

# An unreadable LFS listing is not an empty one: passing it as "no drift" is the silent pass to avoid.
not_repo="$tmp_dir/not-a-repo"
mkdir -p "$not_repo/scripts/ci"
cp "$manifest" "$not_repo/scripts/ci/"
set +e
out=$(GIT_CEILING_DIRECTORIES="$tmp_dir" REPO_ROOT="$not_repo" bash "$checker" 2>&1); status=$?
set -e
[[ $status -ne 0 ]] || fail "a tree git lfs cannot list must fail the check, got: $out"
[[ $out == *'could not list'* ]] || fail "the error should say the listing failed, got: $out"

set +e
out=$(REPO_ROOT="$tmp_dir/nowhere" bash "$checker" 2>&1); status=$?
set -e
[[ $status -ne 0 ]] || fail "a missing manifest must fail the check, got: $out"
[[ $out == *'manifest not found'* ]] || fail "the error should say the manifest is missing, got: $out"

# --- the bundler --------------------------------------------------------------------------------------

# build-media-bundles.sh called its own copy of this comparison a warning, but `diff` exiting 1 under
# pipefail aborted the build mid-message. It now refuses drift on purpose, through the same check CI
# runs: a bundle built from a drifted manifest omits new media or carries deleted media to every deploy.
# It needs real bytes to bundle; ls-files reads the commit, so writing them over the committed pointers
# leaves the tracked list as it was.
for path in "$kit/musics/theme.mp3" "$web/promo.mp4" "$web/teaser.mp4"; do
  printf 'real bytes for %s\n' "$path" > "$repo/$path"
done
bundles="$tmp_dir/bundles"
build() { REPO_ROOT="$repo" CI_MEDIA_OUT_DIR="$bundles" bash "$builder" web 2>&1; }

write_manifest "$kit/musics/theme.mp3" "$web/promo.mp4"
set +e
out=$(build); status=$?
set -e
[[ $status -ne 0 ]] || fail "the bundler must refuse a drifted manifest, got: $out"
[[ $out == *"$web/teaser.mp4"* && $out == *'publish-media-bundles.sh web'* ]] ||
  fail "the bundler should explain the drift in full, not stop mid-message, got: $out"
[[ ! -e $bundles/web-media.tar.gz ]] || fail 'the bundler must not build from a drifted manifest'

write_manifest "$kit/musics/theme.mp3" "$web/promo.mp4" "$web/teaser.mp4"
out=$(build) || fail "an agreeing manifest should bundle, got: $out"
[[ -f $bundles/web-media.tar.gz ]] || fail 'an agreeing manifest should produce the bundle'

printf 'all check-web-manifest-drift tests passed\n'
