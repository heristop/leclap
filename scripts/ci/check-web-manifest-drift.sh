#!/usr/bin/env bash
set -euo pipefail

# Fails when scripts/ci/lfs-web-assets.txt stops listing exactly the Git LFS assets under the trees the
# web build ships. Nothing downstream would notice: GitHub Actions never fetches the web bundle, and the
# Cloudflare Pages build that does extracts all of it. A line left behind after its media is deleted
# therefore re-creates that file on every deploy (e50fd210 shipped ten deleted videos that way), and an
# asset the manifest never lists deploys as its bare LFS pointer.
#
#   bash scripts/ci/check-web-manifest-drift.sh
#
# Reads LFS pointers, not media, so a bare checkout will do — but it needs git-lfs to list them.
# REPO_ROOT picks the checkout to check; it defaults to the enclosing one.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/media-bundle.sh
source "$script_dir/media-bundle.sh"

repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
manifest=scripts/ci/lfs-web-assets.txt

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[ -f "$repo_root/$manifest" ] || fail "manifest not found: $repo_root/$manifest"

drift=$(media_web_manifest_drift "$repo_root/$manifest" "$repo_root") ||
  fail "could not list the Git LFS assets in ${repo_root} — is git-lfs installed?"

if [ -z "$drift" ]; then
  count=$(media_manifest_paths "$repo_root/$manifest" | LC_ALL=C sort -u | grep -c '' || true)
  echo "$manifest lists exactly the $count Git LFS assets the web build ships"
  exit 0
fi

# One heading per direction with its paths indented beneath; a direction without paths prints nothing.
group() { # $1 = tag from media_web_manifest_drift, $2 = heading
  local paths
  paths=$(printf '%s\n' "$drift" | sed -n "s/^$1 /    /p")
  [ -n "$paths" ] || return 0
  printf '  %s\n%s\n' "$2" "$paths"
}

report=$(
  group extra \
    'In the manifest but not in Git LFS (deleted or moved) — every web deploy re-creates these from the bundle:'
  group missing 'In Git LFS but not in the manifest — every web deploy ships these as bare LFS pointers:'
)

fail "$manifest has drifted from the Git LFS assets the web build ships.
$report
  Fix it with the procedure in the manifest's header:
    1. make its path list match
         git lfs ls-files -n | grep -E '${MEDIA_WEB_LFS_TREES}' | sort
       deleting stale lines by hand: update-media-manifest.sh cannot hash a file that is gone
    2. bash scripts/ci/update-media-manifest.sh
    3. bash scripts/ci/publish-media-bundles.sh web
  The web bundle is addressed by the manifest's digest, which any change to the path list moves: publish
  it before pushing the fix, or the web build 404s fetching a bundle that does not exist yet."
