#!/usr/bin/env bash
set -euo pipefail

# Materializes the web build's media — every Git LFS asset listed in scripts/ci/lfs-web-assets.txt
# (the creative-kit library staged into public/ by copy-core-assets.ts, plus the web's own clips) —
# from the prebuilt web-media.tar.gz bundle.
#
# Cloudflare Pages must set GIT_LFS_SKIP_SMUDGE=1 so its clone leaves LFS pointers instead of failing
# the checkout on the exhausted budget; this script then fills those pointers in.
#
# Environment:
#   CI_MEDIA_BASE_URL  where bundles live, used verbatim. Unset resolves to the R2 bucket, pinned by
#                      the manifest digest. Set it to the ci-assets-v1 release URL to roll back.
#   CI_MEDIA_TAG       release tag, when falling back to the GitHub Release.
#   CI_MEDIA_MANIFEST  manifest path. Defaults to scripts/ci/lfs-web-assets.txt.
#   REPO_ROOT          tree to materialize into. Defaults to the enclosing git checkout.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/ci/fetch-media-bundle.sh
source "$script_dir/fetch-media-bundle.sh"

media_fetch_bundle web-media.tar.gz scripts/ci/lfs-web-assets.txt
