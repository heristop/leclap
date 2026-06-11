#!/usr/bin/env bash
# One-shot build of the on-device FFmpeg engine into the Expo module. The staged binaries
# (android jniLibs .so, ios LeclapFfmpegCore.xcframework) are NOT committed — this script is how
# they are (re)produced: FFmpeg deps + static libs per target, then the Rust engine on top.
# Usage: build-engine.sh [android|ios|all]   (default: all; ios requires macOS + Xcode)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODULE="$REPO_ROOT/apps/leclap-expo/modules/leclap-ffmpeg"
TARGET="${1:-all}"

build_android() {
  bash "$SCRIPT_DIR/build-deps.sh"
  bash "$SCRIPT_DIR/build-android.sh"
  bash "$REPO_ROOT/packages/ffmpeg-engine/build-android-jni.sh" "$MODULE/android/src/main/jniLibs"
}

build_ios() {
  [ "$(uname)" = "Darwin" ] || { echo "[engine] ios build requires macOS"; exit 1; }
  bash "$SCRIPT_DIR/build-deps-ios.sh"
  bash "$SCRIPT_DIR/build-ios.sh"
  bash "$REPO_ROOT/packages/ffmpeg-engine/build-ios-lib.sh" "$MODULE/ios"
}

case "$TARGET" in
  android) build_android ;;
  ios) build_ios ;;
  all) build_android; build_ios ;;
  *) echo "usage: build-engine.sh [android|ios|all]"; exit 1 ;;
esac
echo "[engine] done → $MODULE"
