#!/usr/bin/env bash
# Build the Rust engine as a self-contained static lib per iOS slice (rustc bundles the
# FFmpeg/fftools/freetype/harfbuzz archives into the staticlib), lipo the simulator slices, and
# assemble LeclapFfmpegCore.xcframework into the Expo module — the device slice is what makes real
# iPhone builds link (the old vendored .a was simulator-only).
# Usage: build-ios-lib.sh <module-ios-dir>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${1:?usage: build-ios-lib.sh <module-ios-dir>}"
OUT="$(cd "$OUT" && pwd)"

DIST_ROOT="$REPO_ROOT/scripts/ffmpeg/dist/ios/slices"
DEPS_ROOT="$REPO_ROOT/scripts/ffmpeg/deps/ios"

# Align rustc's deployment target with the FFmpeg slices (IOS_MIN in versions.env). Without this
# rustc links at its default (iOS 10) and ld hides ___chkstk_darwin, which the iOS-13-built
# FFmpeg/fftools objects reference, failing the device link.
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/ffmpeg/versions.env"
export IPHONEOS_DEPLOYMENT_TARGET="$IOS_MIN"

declare -a SLICES=(device sim-arm64 sim-x86_64)
triple() {
  case "$1" in
    device) echo "aarch64-apple-ios" ;;
    sim-arm64) echo "aarch64-apple-ios-sim" ;;
    sim-x86_64) echo "x86_64-apple-ios" ;;
  esac
}

for slice in "${SLICES[@]}"; do
  DIST="$DIST_ROOT/$slice"
  [ -f "$DEPS_ROOT/$slice/lib/pkgconfig/harfbuzz.pc" ] || { echo "missing iOS deps for $slice (run scripts/ffmpeg/build-deps-ios.sh $slice)"; exit 1; }
  [ -d "$DIST/lib/pkgconfig" ] || { echo "missing FFmpeg iOS build for $slice (run scripts/ffmpeg/build-ios.sh $slice)"; exit 1; }
  export FFMPEG_PKG_CONFIG_PATH="$DIST/lib/pkgconfig"
  export PKG_CONFIG_PATH="$DIST/lib/pkgconfig:$DEPS_ROOT/$slice/lib/pkgconfig"
  export PKG_CONFIG_ALLOW_CROSS=1
  export PKG_CONFIG_ALL_STATIC=1
  echo "[engine][ios:$slice] cargo build (static FFmpeg) ..."
  ( cd "$HERE" && cargo build --release --target "$(triple "$slice")" --lib )
done

# CocoaPods requires the same binary name in every slice, so the lipo'd simulator archive keeps
# the device name inside its own staging subdir.
STAGE="$HERE/target/ios-xcf"
rm -rf "$STAGE"; mkdir -p "$STAGE/sim"
lipo -create \
  "$HERE/target/aarch64-apple-ios-sim/release/libleclap_ffmpeg_core.a" \
  "$HERE/target/x86_64-apple-ios/release/libleclap_ffmpeg_core.a" \
  -output "$STAGE/sim/libleclap_ffmpeg_core.a"

rm -rf "$OUT/LeclapFfmpegCore.xcframework"
xcodebuild -create-xcframework \
  -library "$HERE/target/aarch64-apple-ios/release/libleclap_ffmpeg_core.a" \
  -library "$STAGE/sim/libleclap_ffmpeg_core.a" \
  -output "$OUT/LeclapFfmpegCore.xcframework"
echo "[engine][ios] LeclapFfmpegCore.xcframework → $OUT"
