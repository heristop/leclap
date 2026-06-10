#!/usr/bin/env bash
# Cross-build the Rust engine for every Android ABI and stage it next to the FFmpeg .so libs in a
# jniLibs tree. Usage: build-android-jni.sh <output-jniLibs-dir>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${1:?usage: build-android-jni.sh <jniLibs-out-dir>}"
mkdir -p "$OUT"
# Resolve to absolute — `cargo ndk -o` runs after we cd into the crate dir, so a relative OUT would
# otherwise land under packages/ffmpeg-engine/ instead of the app's jniLibs.
OUT="$(cd "$OUT" && pwd)"

NDK="${ANDROID_NDK_HOME:-$HOME/Library/Android/sdk/ndk/27.1.12297006}"
SYSROOT="$NDK/toolchains/llvm/prebuilt/darwin-x86_64/sysroot"
DIST_ROOT="$REPO_ROOT/scripts/ffmpeg/dist/android"

# ABI → bindgen clang target triple (NDK uses armv7a- for the eabi clang frontend).
declare -a ABIS=(arm64-v8a armeabi-v7a x86_64)
bindgen_triple() {
  case "$1" in
    arm64-v8a) echo "aarch64-linux-android" ;;
    armeabi-v7a) echo "armv7a-linux-androideabi" ;;
    x86_64) echo "x86_64-linux-android" ;;
  esac
}

FT_ROOT="$REPO_ROOT/scripts/ffmpeg/deps/android"
for abi in "${ABIS[@]}"; do
  DIST="$DIST_ROOT/$abi"
  FT="$FT_ROOT/$abi"
  [ -d "$DIST/lib/pkgconfig" ] || { echo "missing FFmpeg build for $abi at $DIST"; exit 1; }
  [ -f "$FT/lib/pkgconfig/freetype2.pc" ] || { echo "missing freetype for $abi at $FT"; exit 1; }
  export ANDROID_NDK_HOME="$NDK"
  # build.rs reads FFMPEG_PKG_CONFIG_PATH for the -L path; the pkg-config crate reads PKG_CONFIG_PATH
  # (both the FFmpeg dist AND freetype, since libavfilter.pc Requires.private freetype2).
  export FFMPEG_PKG_CONFIG_PATH="$DIST/lib/pkgconfig"
  export PKG_CONFIG_PATH="$DIST/lib/pkgconfig:$FT/lib/pkgconfig"
  export PKG_CONFIG_ALLOW_CROSS=1
  # FFmpeg + fftools are statically linked into the engine .so (self-contained — no FFmpeg .so deps
  # to resolve at runtime, which sidesteps JNA's dlopen namespace not searching jniLibs).
  # PKG_CONFIG_ALL_STATIC pulls in FFmpeg's Libs.private (transitive system deps) for the static link.
  export PKG_CONFIG_ALL_STATIC=1
  echo "[engine][$abi] cargo ndk build (static FFmpeg) ..."
  # 64-bit ABIs get 16 KB segment alignment from .cargo/config.toml (Google Play 16 KB page rule).
  ( cd "$HERE" && cargo ndk -t "$abi" --platform 24 -o "$OUT" build --release --lib )
  echo "[engine][$abi] staged → $OUT/$abi (self-contained)"
done
echo "[engine] all ABIs done → $OUT"
