---
name: ondevice-ffmpeg-engine
description: Use when building, modifying, or consuming the on-device FFmpeg engine — the Rust crate packages/ffmpeg-engine, the leclap-ffmpeg Expo native module, the run/probe/version/cancel API, the uniffi bindings, build-engine.sh, or the FFmpeg-from-source toolchain in scripts/ffmpeg.
---

# On-Device FFmpeg Engine

## Overview

The Expo app compiles video **fully on-device** (no server, no upload) by running real FFmpeg in-process through a Rust engine that statically links patched FFmpeg `fftools`. The same `ffmpeg-video-composer` core that drives Node/WASM drives this engine via one more `AbstractFFmpeg` implementation. Full architecture + boundary contracts: **`docs/on-device-compilation.md`**.

Two halves:

- **Build toolchain** — `scripts/ffmpeg/` cross-compiles FFmpeg + deps into static libs (`libfftools.a` …) per target.
- **Runtime engine** — `packages/ffmpeg-engine/` (Rust + uniffi) → `apps/leclap-expo/modules/leclap-ffmpeg/` (Expo native module, Kotlin + Swift).

Call chain: core `FFmpegLeclapAdapter.execute(cmd)` → `parseCommand` → `Leclap.run(argv)` (native module) → uniffi → Rust `lib.rs` → C shim `ffmpeg_shim.c` → patched `ffmpeg_main`/`ffprobe_main`.

## API surface (the native module / Rust uniffi exports)

`apps/leclap-expo/modules/leclap-ffmpeg/index.ts` re-exports the uniffi functions:

- `run(args: string[]): Promise<{ code, log }>` — runs ffmpeg; `args` **exclude** the program name (the shim prepends `ffmpeg`); captures stderr as `log`.
- `probe(args: string[]): Promise<{ code, output }>` — runs ffprobe; captures stdout (`-print_format json`).
- `version(): string` — FFmpeg build version; also the presence probe (`ffmpegAvailability.ts`).
- `cancel(): void` — cooperative cancel of the in-flight `run` (sets fftools' shutdown flags; the run exits ~as on SIGTERM, returns 255). No-op when idle.

No shell is ever involved — `run`/`probe` invoke `ffmpeg_main`/`ffprobe_main` in-process with an argv array. All calls serialize behind a process-global `ENGINE_LOCK` (fftools hold global state).

## Consuming it from the core

The core stays Expo-free: `CoreCompilationService` injects `{ run: Leclap.run, probe: Leclap.probe }` as the `NativeEngine` into `compileReactNative(...)`; `FFmpegLeclapAdapter` is the `AbstractFFmpeg`. Cancellation is wired from an `AbortSignal` → `Leclap.cancel()` in `CoreCompilationService`. Don't add a second engine path — add capabilities to the core command builders, not here.

## Building (binaries are NEVER committed — rebuild from source)

`scripts/ffmpeg/build-engine.sh [android|ios|all]` orchestrates everything: FFmpeg deps + static libs, then the Rust engine, staged into the module (`android/src/main/jniLibs/`, `ios/LeclapFfmpegCore.xcframework`). Prerequisites:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android \
  aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo install cargo-ndk            # android (also needs NDK 27.1 — see versions.env)
```

Host build for `cargo test` (real run/probe/cancel/re-entrancy/drawtext) — from `packages/ffmpeg-engine/`:

```bash
bash scripts/ffmpeg/build-host.sh   # builds dist/host/lib/libfftools.a once
export FFMPEG_PKG_CONFIG_PATH="$PWD/../../scripts/ffmpeg/dist/host/lib/pkgconfig"
export PKG_CONFIG_PATH="$FFMPEG_PKG_CONFIG_PATH"   # REQUIRED, or Homebrew's ffmpeg .pc leaks in → undefined Wels*/avcodec symbols
export DYLD_FALLBACK_LIBRARY_PATH="$PWD/../../scripts/ffmpeg/dist/host/lib"
export CARGO_TARGET_DIR=target-host
cargo test --release
```

## Regenerating uniffi bindings (after changing the Rust API)

```bash
cargo run --release --bin uniffi-bindgen -- generate \
  --library target-host/release/libleclap_ffmpeg_core.dylib --language kotlin --language swift --out-dir bindings
```

Then copy into the module (bindings live in TWO places — drift = a runtime uniffi checksum mismatch):
`bindings/uniffi/.../leclap_ffmpeg_core.kt` → module `android/.../uniffi/...`, and `bindings/leclap_ffmpeg_core.swift` + `leclap_ffmpeg_coreFFI.h` → module `ios/Generated/`. Then surface the new fn in the Kotlin/Swift `*Module` and `index.ts`.

## Gotchas (most cost real debugging time)

- **FFmpeg is pinned to n8.0.** `scripts/ffmpeg/patch-fftools.sh` renames `main`→`ffmpeg_main`, resets fftools globals for **re-entrancy**, and injects the `cancel` hook (the shutdown flags are `static` in n8.0 — the hook must live in the same TU). An FFmpeg bump can silently break all three. **The `cli.rs` + `cancel.rs` host tests are the upgrade gate** — run them after any version change.
- **Android 16 KB pages:** `.cargo/config.toml` sets `max-page-size=16384` for arm64-v8a/x86_64 (Google Play rule); armv7 stays 4096. Verify with `llvm-readelf -l` → LOAD align `0x4000`.
- **iOS xcframework** needs device **and** simulator slices (`build-ios-lib.sh`); export `IPHONEOS_DEPLOYMENT_TARGET=$IOS_MIN` (else `___chkstk_darwin` undefined) and keep the same binary name in every slice (CocoaPods requirement).
- **Host link:** brew openh264 ships only a dylib → `build.rs` links it dynamically (macOS host only); Android/iOS embed/replace it.
- Pins that exist for a reason: **NDK 27.1** (`plugins/withNdkVersion.js`, for `std::format`), **JNA 5.17** (page alignment), self-contained `.so` (uniffi's JNA dlopen namespace can't resolve transitive FFmpeg `.so`s → everything is statically linked).
- Codecs: Android `libopenh264` (LGPL software), iOS `h264_videotoolbox` (hardware) — set in `CoreCompilationService` `codecConfig`; the LGPL build has **no libx264**.

## Common mistakes

- Editing the staged `.so`/xcframework or expecting them in git — they're gitignored; rebuild with `build-engine.sh`.
- Changing the Rust API without regenerating + copying bindings to both module locations → uniffi checksum panic at load.
- Forgetting `PKG_CONFIG_PATH` for host `cargo test` → confusing `Wels*` link errors.
- Passing the program name in `run`/`probe` args — the shim prepends it.
- Adding capabilities here instead of in the shared core command builders — the engine is just an executor.
