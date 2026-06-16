# FFmpeg Engine Hardening & OSS Repo Hygiene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> On execution start, save a copy of this plan to `docs/superpowers/plans/2026-06-10-ffmpeg-engine-hardening.md` (plan mode restricted writes to this file during planning).

**Goal:** Fix the audit's Critical + High findings on the on-device FFmpeg pipeline — iOS device xcframework (C1), Android 16 KB page alignment (C2), cooperative cancellation (H1), binary artifact hygiene for open source (H2), panic-safe fd capture (H3).

**Architecture:** The Rust engine (`packages/ffmpeg-engine`) statically links patched FFmpeg n8.0 fftools and is exposed to Expo via uniffi. Binaries become build-from-source artifacts (gitignored, one orchestrator script). Cancellation reuses fftools' own SIGTERM flags (already reset per-run by the re-entrancy patch). iOS ships as an xcframework with device + simulator slices.

**Tech Stack:** Rust + uniffi 0.28, C shim, bash build scripts (NDK 27.1 / cargo-ndk / Xcode), Expo Modules (Kotlin/Swift), TypeScript, jest (`jest-expo`).

**Conventions (from repo memory):** commit messages are conventional + lowercase + short subject only, no body, no co-author trailer. No `else` in TS — early returns. No `eslint-disable`. The branch has many unrelated modified files — always `git add` explicit paths, never `-A`.

**Audit cross-reference:** C1 = sim-only iOS `.a` (`LC_BUILD_VERSION platform 7`); C2 = `max-page-size=4096` vs Google Play 16 KB rule; H1 = no cancel once `run()` starts; H2 = ~250 MB untracked binaries; H3 = `with_captured_fd` leaks/corrupts fds on panic.

---

### Task 1: Ignore engine binaries, commit the module source (H2 part 1)

**Files:**

- Modify: `.gitignore`
- Commit (untracked source): `apps/le-clap-expo/modules/` (Kotlin/Swift/TS/podspec/gradle — NOT the `.so`/`.a`)

- [ ] **Step 1: Add ignore rules**

Append to `.gitignore` (after the existing "On-device FFmpeg engine" block at lines 34-38):

```gitignore
# Engine binaries staged into the Expo module — never committed; rebuild with
# scripts/ffmpeg/build-engine.sh (see docs/on-device-compilation.md).
apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/jniLibs/
apps/le-clap-expo/modules/leclap-ffmpeg/ios/libleclap_ffmpeg_core.a
apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpegCore.xcframework/
```

- [ ] **Step 2: Verify the rules match**

Run: `git check-ignore -v apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/jniLibs/arm64-v8a/libleclap_ffmpeg_core.so apps/le-clap-expo/modules/leclap-ffmpeg/ios/libleclap_ffmpeg_core.a`
Expected: both paths print a matching `.gitignore` rule. (The xcframework doesn't exist yet — created in Task 6.)

- [ ] **Step 3: Stage module source and prove no binaries are staged**

```bash
git add .gitignore apps/le-clap-expo/modules/
git diff --cached --stat | grep -E '\.(a|so)' && echo "FAIL: binary staged" || echo "OK: no binaries"
```

Expected: `OK: no binaries`, and `git diff --cached --stat` shows only `.kt`, `.swift`, `.ts`, `.h`, `.modulemap`, `.podspec`, `build.gradle`, `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: ignore on-device engine binaries"
```

---

### Task 2: Panic-safe fd capture — RAII guard (H3)

**Files:**

- Modify: `packages/ffmpeg-engine/src/lib.rs:57-81` (replace `with_captured_fd`)
- Test: unit test appended to `packages/ffmpeg-engine/src/lib.rs` (function is private — must be a unit test, not `tests/cli.rs`)

**Prerequisite (once for Tasks 2-4):** host FFmpeg build present — if `scripts/ffmpeg/dist/host/lib/pkgconfig` is missing, run `bash scripts/ffmpeg/build-host.sh` first. All `cargo` commands below run from `packages/ffmpeg-engine/` with:

```bash
export FFMPEG_PKG_CONFIG_PATH="$(git rev-parse --show-toplevel)/scripts/ffmpeg/dist/host/lib/pkgconfig"
export DYLD_FALLBACK_LIBRARY_PATH="$(git rev-parse --show-toplevel)/scripts/ffmpeg/dist/host/lib"
export CARGO_TARGET_DIR=target-host
```

- [ ] **Step 1: Write the failing test**

Append to `packages/ffmpeg-engine/src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn with_captured_fd_restores_after_a_panicking_body() {
        let tmp = std::env::temp_dir().join("leclap-panic.log");
        let result =
            std::panic::catch_unwind(|| with_captured_fd(2, "leclap-panic.log", || panic!("boom")));
        assert!(result.is_err());

        // If fd 2 is still redirected, this write lands in the capture file and grows it.
        let before = std::fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0);
        unsafe { libc::write(2, "x".as_ptr().cast(), 1) };
        let after = std::fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0);

        let _ = std::fs::remove_file(&tmp);
        assert_eq!(before, after, "stderr is still redirected to the capture file");
    }
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cargo test --release with_captured_fd_restores -- --nocapture`
Expected: FAIL on the `assert_eq!` (file grew — fd 2 still points at the capture file).

- [ ] **Step 3: Replace `with_captured_fd` with the RAII version**

Replace lines 57-81 of `src/lib.rs` with:

```rust
/// Restores `target_fd` from a saved duplicate when dropped — including during a panic unwind — so a
/// failure inside the captured body can never leave stdout/stderr pointing at the capture file.
struct FdRestore {
    target_fd: c_int,
    saved: c_int,
}

impl Drop for FdRestore {
    fn drop(&mut self) {
        unsafe {
            libc::fflush(std::ptr::null_mut()); // flush all open C output streams
            libc::dup2(self.saved, self.target_fd);
            libc::close(self.saved);
        }
    }
}

/// Run `body` with the C file descriptor `target_fd` (1=stdout, 2=stderr) redirected to a temp file,
/// then read that file back. fftools write via C stdio, so the guard flushes before restoring.
fn with_captured_fd<F: FnOnce() -> i32>(target_fd: c_int, tmp_name: &str, body: F) -> (i32, String) {
    let tmp = std::env::temp_dir().join(tmp_name);
    let file = match std::fs::File::create(&tmp) {
        Ok(f) => f,
        Err(_) => return (body(), String::new()),
    };

    let saved = unsafe { libc::dup(target_fd) };
    if saved < 0 {
        return (body(), String::new());
    }

    let restore = FdRestore { target_fd, saved };
    unsafe { libc::dup2(file.as_raw_fd(), target_fd) };

    let code = body();
    drop(restore); // flush + restore before reading the capture back

    let captured = std::fs::read_to_string(&tmp).unwrap_or_default();
    let _ = std::fs::remove_file(&tmp);

    (code, captured)
}
```

- [ ] **Step 4: Run the full engine test suite**

Run: `cargo test --release`
Expected: PASS — the new unit test plus all of `tests/cli.rs` (`version_is_ffmpeg_8`, `run_transcodes_and_probe_reads_it`, `run_is_reentrant_across_calls`, drawtext tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ffmpeg-engine/src/lib.rs
git commit -m "fix(engine): raii fd restore in capture"
```

---

### Task 3: Cooperative cancellation in Rust/C (H1 part 1)

fftools/ffmpeg.c already has cooperative shutdown flags (`received_sigterm`, `received_nb_signals`) that the transcode loop polls, and the existing re-entrancy patch (`scripts/ffmpeg/patch-fftools.sh:26`) resets them at every `ffmpeg_main` entry. Setting them mid-run makes ffmpeg shut down cleanly and return 255 — no signals, no threads killed.

**Files:**

- Modify: `packages/ffmpeg-engine/csrc/ffmpeg_shim.c`
- Modify: `packages/ffmpeg-engine/src/lib.rs`
- Test: `packages/ffmpeg-engine/tests/cli.rs`

- [ ] **Step 1: Verify the flags are linkable (global, not static)**

Run: `nm scripts/ffmpeg/dist/host/lib/libfftools.a 2>/dev/null | grep -w received_sigterm`
Expected: a line with a **capital** symbol type (`D`/`B`/`S`) → externally visible.
Contingency: if lowercase (`d`/`b`), add a step to `patch-fftools.sh` that strips `static` from the two declarations in `fftools/ffmpeg.c` and rebuild the host dist before continuing.

- [ ] **Step 2: Write the failing test**

Append to `packages/ffmpeg-engine/tests/cli.rs` (add `cancel` to the existing `use leclap_ffmpeg_core::{...}` import):

```rust
#[test]
fn cancel_aborts_an_inflight_run() {
    let out = tmp("leclap_cli_cancel.mp4");
    let _ = std::fs::remove_file(&out);

    let handle = std::thread::spawn({
        let out = out.clone();
        move || {
            run(s(&[
                "-y", "-f", "lavfi", "-i", "testsrc=duration=120:size=1920x1080:rate=60",
                "-c:v", "mpeg4", "-q:v", "4", &out,
            ]))
        }
    });

    std::thread::sleep(std::time::Duration::from_secs(1));
    cancel();
    let result = handle.join().expect("run thread");

    // A run that completed normally exits 0 — non-zero proves the cancel interrupted it.
    assert_ne!(result.code, 0, "cancelled run must not report success");
}
```

- [ ] **Step 3: Run it, verify it fails to compile**

Run: `cargo test --release cancel_aborts -- --nocapture`
Expected: FAIL — `cannot find function 'cancel' in crate 'leclap_ffmpeg_core'`.

- [ ] **Step 4: Add the C cancel hook**

Append to `packages/ffmpeg-engine/csrc/ffmpeg_shim.c`:

```c
#include <signal.h>

/* fftools/ffmpeg.c's cooperative shutdown flags (declared in fftools/ffmpeg.h; reset by the
 * leclap-reentrancy patch at every ffmpeg_main entry). Setting them mimics ONE SIGTERM: the
 * transcode loop notices, shuts down cleanly, and ffmpeg_main returns 255. */
extern volatile int received_sigterm;
extern volatile int received_nb_signals;

void leclap_ffmpeg_cancel(void) {
    received_sigterm = SIGTERM;
    received_nb_signals = 1;
}
```

- [ ] **Step 5: Export `cancel` from Rust**

In `packages/ffmpeg-engine/src/lib.rs`, add to the `extern "C"` block (after `av_version_info`):

```rust
    fn leclap_ffmpeg_cancel();
```

and add after the `probe` function:

```rust
/// Request cooperative cancellation of the in-flight `run` — equivalent to sending ffmpeg one
/// SIGTERM: the transcode loop exits cleanly and `run` returns code 255. Safe to call at any time
/// (the flags are reset at the start of every run); no effect on `probe`. Deliberately does NOT
/// take ENGINE_LOCK — the running `run` holds it.
#[uniffi::export]
pub fn cancel() {
    unsafe { leclap_ffmpeg_cancel() };
}
```

- [ ] **Step 6: Run the engine tests**

Run: `cargo test --release`
Expected: PASS, including `cancel_aborts_an_inflight_run` (finishing in a few seconds, not the ~2 min an uncancelled 120 s/1080p60 encode would take).

- [ ] **Step 7: Commit**

```bash
git add packages/ffmpeg-engine/csrc/ffmpeg_shim.c packages/ffmpeg-engine/src/lib.rs packages/ffmpeg-engine/tests/cli.rs
git commit -m "feat(engine): cancel in-flight ffmpeg run"
```

---

### Task 4: Regenerate uniffi bindings + expose cancel to JS (H1 part 2)

**Files:**

- Regenerate: `packages/ffmpeg-engine/bindings/` (kotlin + swift + header)
- Copy into: `apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/java/uniffi/leclap_ffmpeg_core/leclap_ffmpeg_core.kt`, `apps/le-clap-expo/modules/leclap-ffmpeg/ios/Generated/{leclap_ffmpeg_core.swift,leclap_ffmpeg_coreFFI.h}`
- Modify: `apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/java/expo/modules/leclapffmpeg/LeclapFfmpegModule.kt`
- Modify: `apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpegModule.swift`
- Modify: `apps/le-clap-expo/modules/leclap-ffmpeg/index.ts`

- [ ] **Step 1: Regenerate bindings from the host cdylib**

From `packages/ffmpeg-engine/` (env from Task 2 prerequisite still exported):

```bash
cargo build --release
cargo run --release --bin uniffi-bindgen -- generate \
  --library target-host/release/libleclap_ffmpeg_core.dylib \
  --language kotlin --language swift --out-dir bindings
```

Expected: `bindings/uniffi/leclap_ffmpeg_core/leclap_ffmpeg_core.kt` and `bindings/leclap_ffmpeg_core.swift` regenerated; `grep -n 'fun .cancel' bindings/uniffi/leclap_ffmpeg_core/leclap_ffmpeg_core.kt` and `grep -n 'public func cancel' bindings/leclap_ffmpeg_core.swift` both hit.

- [ ] **Step 2: Copy generated bindings into the module**

```bash
cp bindings/uniffi/leclap_ffmpeg_core/leclap_ffmpeg_core.kt \
   ../../apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/java/uniffi/leclap_ffmpeg_core/leclap_ffmpeg_core.kt
cp bindings/leclap_ffmpeg_core.swift ../../apps/le-clap-expo/modules/leclap-ffmpeg/ios/Generated/leclap_ffmpeg_core.swift
cp bindings/leclap_ffmpeg_coreFFI.h  ../../apps/le-clap-expo/modules/leclap-ffmpeg/ios/Generated/leclap_ffmpeg_coreFFI.h
```

(`ios/Generated/module.modulemap` is a stable rename of the generated modulemap — leave it.)

- [ ] **Step 3: Expose cancel in the Kotlin module**

In `LeclapFfmpegModule.kt`, add the import `import uniffi.leclap_ffmpeg_core.cancel as nativeCancel` (alphabetical, before `probe`) and add inside `ModuleDefinition` after `Function("version")`:

```kotlin
    // Cooperative cancel of the in-flight run: sets fftools' shutdown flags (same effect as SIGTERM); returns before ffmpeg exits.
    Function("cancel") { nativeCancel() }
```

- [ ] **Step 4: Expose cancel in the Swift module**

In `LeclapFfmpegModule.swift`, add after the `Function("version")` block:

```swift
    // Cooperative cancel of the in-flight run: sets fftools' shutdown flags (same effect as SIGTERM); returns before ffmpeg exits.
    Function("cancel") {
      cancel()
    }
```

- [ ] **Step 5: Expose cancel in the TS surface**

In `modules/leclap-ffmpeg/index.ts`, add `cancel(): void;` to `LeclapFfmpegNativeModule` (after `version`), and append:

```ts
/** Cooperatively cancel the in-flight `run` — ffmpeg exits as on SIGTERM and `run` resolves with code 255. */
export function cancel(): void {
  Native.cancel();
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/le-clap-expo && npx tsc --noEmit`
Expected: no new errors.

```bash
git add packages/ffmpeg-engine/bindings apps/le-clap-expo/modules/leclap-ffmpeg
git commit -m "feat(expo): expose engine cancel to js"
```

---

### Task 5: Android 16 KB page alignment (C2)

**Files:**

- Modify: `packages/ffmpeg-engine/.cargo/config.toml`
- Modify: `packages/ffmpeg-engine/build-android-jni.sh:44` (stale comment)
- Rebuild: `apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/jniLibs/` (gitignored — not committed)

- [ ] **Step 1: Update the linker flags**

Replace the full contents of `packages/ffmpeg-engine/.cargo/config.toml` with:

```toml
# Android link tuning for the engine .so:
#  - max-page-size: Google Play requires 16 KB page-size support for 64-bit native libs (apps
#    targeting Android 15+), so arm64-v8a/x86_64 align LOAD segments to 16384 — 16 KB-aligned ELFs
#    also load on 4 KB-page devices. armeabi-v7a is 32-bit (no 16 KB requirement) and stays at 4096.
#  - --no-as-needed: keep DT_NEEDED entries for ALL FFmpeg libs we link. Without it the linker drops
#    libavutil/avformat/avfilter/swscale/swresample (their symbols resolve transitively at link time),
#    so at runtime `av_version_info` & co. can't be located and dlopen fails.
[target.aarch64-linux-android]
rustflags = ["-Clink-arg=-Wl,-z,max-page-size=16384"]
[target.armv7-linux-androideabi]
rustflags = ["-Clink-arg=-Wl,-z,max-page-size=4096"]
[target.x86_64-linux-android]
rustflags = ["-Clink-arg=-Wl,-z,max-page-size=16384"]
```

- [ ] **Step 2: Fix the stale comment in build-android-jni.sh**

Replace line 44 (`# 4 KB segment alignment comes from .cargo/config.toml's max-page-size=4096 link flag.`) with:

```bash
  # 64-bit ABIs get 16 KB segment alignment from .cargo/config.toml (Google Play 16 KB page rule).
```

- [ ] **Step 3: Rebuild the jniLibs**

Prerequisite: `scripts/ffmpeg/dist/android/<abi>/lib/pkgconfig` exists for all 3 ABIs (else run `bash scripts/ffmpeg/build-deps.sh && bash scripts/ffmpeg/build-android.sh` first — ~30 min).

```bash
bash packages/ffmpeg-engine/build-android-jni.sh apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/jniLibs
```

Expected: `[engine] all ABIs done` and three fresh `.so` files.

- [ ] **Step 4: Verify segment alignment**

```bash
NDK_BIN="$HOME/Library/Android/sdk/ndk/27.1.12297006/toolchains/llvm/prebuilt/darwin-x86_64/bin"
"$NDK_BIN/llvm-readelf" -l apps/le-clap-expo/modules/leclap-ffmpeg/android/src/main/jniLibs/arm64-v8a/libleclap_ffmpeg_core.so | grep LOAD
```

Expected: every LOAD row's last column (`Align`) is `0x4000`. Repeat for `x86_64` (`0x4000`) and `armeabi-v7a` (`0x1000`).

- [ ] **Step 5: Smoke-test dlopen on the API 34 emulator**

Build and launch the app on the existing Android emulator (`cd apps/le-clap-expo && npx expo run:android`), open the ffmpeg spike screen (`app/(fullscreen)/ffmpeg-spike.tsx`) and confirm `version()` reports `n8.0` (proves the 16 KB-aligned .so dlopens on a 4 KB-page image — the failure mode the old comment feared).
Contingency: if dlopen fails with the historical `"did_read_ failed"`, append `"-Clink-arg=-Wl,-z,separate-loadable-segments"` to the two 64-bit rustflags arrays and rebuild.
If a 16 KB AVD image (Android 15 16 KB system image) is installed, repeat there.

- [ ] **Step 6: Commit (config + comment only — binaries are ignored)**

```bash
git add packages/ffmpeg-engine/.cargo/config.toml packages/ffmpeg-engine/build-android-jni.sh
git commit -m "fix(android): 16kb page alignment for engine"
```

---

### Task 6: iOS xcframework with device + simulator slices (C1)

**Files:**

- Create: `packages/ffmpeg-engine/build-ios-lib.sh`
- Modify: `apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpeg.podspec`
- Produce (gitignored): `apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpegCore.xcframework/`

- [ ] **Step 1: Install the Rust iOS targets**

Run: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`

- [ ] **Step 2: Ensure all three FFmpeg iOS slices exist**

Check `scripts/ffmpeg/dist/ios/slices/{device,sim-arm64,sim-x86_64}/lib/pkgconfig` — if any missing: `bash scripts/ffmpeg/build-deps-ios.sh && bash scripts/ffmpeg/build-ios.sh` (~45 min).

- [ ] **Step 3: Create `packages/ffmpeg-engine/build-ios-lib.sh`**

```bash
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
  [ -d "$DIST/lib/pkgconfig" ] || { echo "missing FFmpeg iOS build for $slice (run scripts/ffmpeg/build-ios.sh)"; exit 1; }
  export FFMPEG_PKG_CONFIG_PATH="$DIST/lib/pkgconfig"
  export PKG_CONFIG_PATH="$DIST/lib/pkgconfig:$DEPS_ROOT/$slice/lib/pkgconfig"
  export PKG_CONFIG_ALLOW_CROSS=1
  export PKG_CONFIG_ALL_STATIC=1
  echo "[engine][ios:$slice] cargo build (static FFmpeg) ..."
  ( cd "$HERE" && cargo build --release --target "$(triple "$slice")" --lib )
done

STAGE="$HERE/target/ios-xcf"
rm -rf "$STAGE"; mkdir -p "$STAGE"
lipo -create \
  "$HERE/target/aarch64-apple-ios-sim/release/libleclap_ffmpeg_core.a" \
  "$HERE/target/x86_64-apple-ios/release/libleclap_ffmpeg_core.a" \
  -output "$STAGE/libleclap_ffmpeg_core-sim.a"

rm -rf "$OUT/LeclapFfmpegCore.xcframework"
xcodebuild -create-xcframework \
  -library "$HERE/target/aarch64-apple-ios/release/libleclap_ffmpeg_core.a" \
  -library "$STAGE/libleclap_ffmpeg_core-sim.a" \
  -output "$OUT/LeclapFfmpegCore.xcframework"
echo "[engine][ios] LeclapFfmpegCore.xcframework → $OUT"
```

Then: `chmod +x packages/ffmpeg-engine/build-ios-lib.sh`

- [ ] **Step 4: Build the xcframework**

```bash
bash packages/ffmpeg-engine/build-ios-lib.sh apps/le-clap-expo/modules/leclap-ffmpeg/ios
```

Expected: xcframework created. Verify slices: `plutil -p apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpegCore.xcframework/Info.plist | grep -A2 SupportedPlatform` → one `ios` (device) and one `ios` + `simulator` variant.

- [ ] **Step 5: Switch the podspec to the xcframework**

In `LeclapFfmpeg.podspec`, replace lines 20-23:

```ruby
  # The FFI header + its modulemap are imported by the uniffi binding via `import leclap_ffmpeg_coreFFI`
  # (resolved through SWIFT_INCLUDE_PATHS below), not compiled directly.
  s.preserve_paths = 'Generated/leclap_ffmpeg_coreFFI.h', 'Generated/module.modulemap'

  # Self-contained static engine (Rust + fftools + FFmpeg + freetype + harfbuzz), device + simulator
  # slices. Built by packages/ffmpeg-engine/build-ios-lib.sh — NOT committed.
  s.vendored_frameworks = 'LeclapFfmpegCore.xcframework'
```

Then delete the now-stale simulator-only `libleclap_ffmpeg_core.a`:

```bash
rm apps/le-clap-expo/modules/leclap-ffmpeg/ios/libleclap_ffmpeg_core.a
```

- [ ] **Step 6: Verify a DEVICE build links (the C1 regression test)**

```bash
cd apps/le-clap-expo/ios && pod install
xcodebuild -workspace LeClap.xcworkspace -scheme LeClap \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -3
```

Expected: `** BUILD SUCCEEDED **` (previously: link error "built for iOS Simulator").

- [ ] **Step 7: Verify the simulator build still works**

```bash
xcodebuild -workspace LeClap.xcworkspace -scheme LeClap \
  -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -3
```

Expected: `** BUILD SUCCEEDED **`. Optionally launch with `npx expo run:ios` and check the spike screen's `version()`.

- [ ] **Step 8: Commit (script + podspec — the xcframework is ignored)**

```bash
git add packages/ffmpeg-engine/build-ios-lib.sh apps/le-clap-expo/modules/leclap-ffmpeg/ios/LeclapFfmpeg.podspec
git rm --cached apps/le-clap-expo/modules/leclap-ffmpeg/ios/libleclap_ffmpeg_core.a 2>/dev/null || true
git commit -m "feat(ios): package engine as xcframework"
```

---

### Task 7: Wire AbortSignal to native cancel (H1 part 3)

**Files:**

- Modify: `apps/le-clap-expo/src/services/compile/CoreCompilationService.ts:62-93`
- Test: Create `apps/le-clap-expo/src/services/compile/CoreCompilationService.test.ts` (jest, same runner as `capability.test.ts`)

- [ ] **Step 1: Write the failing test**

Create `CoreCompilationService.test.ts`:

```ts
import { CoreCompilationService } from './CoreCompilationService';
import * as Leclap from '@/modules/leclap-ffmpeg';
import { compileReactNative } from 'ffmpeg-video-composer/reactnative';
import type { CompileInput } from './CompileService';

jest.mock('@/modules/leclap-ffmpeg', () => ({
  run: jest.fn(),
  probe: jest.fn(),
  cancel: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
}));

jest.mock('ffmpeg-video-composer/reactnative', () => ({
  compileReactNative: jest.fn(),
}));

const input = { descriptor: { sections: [] }, clips: {} } as unknown as CompileInput;

beforeEach(() => jest.clearAllMocks());

describe('CoreCompilationService abort wiring', () => {
  it('forwards an abort to the native cancel while compiling', async () => {
    const controller = new AbortController();

    (compileReactNative as jest.Mock).mockImplementation(async () => {
      controller.abort();
      return '/cache/out.mp4';
    });

    await new CoreCompilationService().compile(input, { signal: controller.signal });

    expect(Leclap.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not cancel after the compile finished', async () => {
    const controller = new AbortController();

    (compileReactNative as jest.Mock).mockResolvedValue('/cache/out.mp4');

    await new CoreCompilationService().compile(input, { signal: controller.signal });
    controller.abort();

    expect(Leclap.cancel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/le-clap-expo && pnpm test -- CoreCompilationService`
Expected: first test FAILS (`cancel` never called — no wiring exists yet); second passes.

- [ ] **Step 3: Add the abort listener**

In `CoreCompilationService.ts`, replace the whole `compile()` method (the try body is today's code unchanged; new lines are the `onAbort` wiring and the `finally`):

```ts
  async compile(input: CompileInput, options: CompileOptions = {}): Promise<CompileResult> {
    if (options.signal?.aborted) {
      return { success: false, error: 'Compilation cancelled.' };
    }

    const projectConfig = await buildProjectConfig(input);
    // Cooperative cancellation: ffmpeg exits as on SIGTERM, the failed run rejects inside
    // compileReactNative, and the catch below surfaces it as a failed compile.
    const onAbort = () => Leclap.cancel();

    options.signal?.addEventListener('abort', onAbort);

    try {
      const outputPath = await compileReactNative(
        projectConfig,
        input.descriptor as Parameters<typeof compileReactNative>[1],
        engine,
        (fraction) => options.onProgress?.({ ratio: fraction, stage: 'Rendering' })
      );

      if (!outputPath) {
        return { success: false, error: 'Compilation produced no output.' };
      }

      const info = await FileSystem.getInfoAsync(toUri(outputPath));

      if (!info.exists || info.size === 0) {
        return { success: false, error: 'Compilation produced an empty output file.' };
      }

      options.onProgress?.({ ratio: 1, stage: 'Done' });

      return { success: true, outputUri: toUri(outputPath) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm test -- CoreCompilationService` → both PASS. Then `pnpm lint` (or the repo's lint-staged) → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/le-clap-expo/src/services/compile/CoreCompilationService.ts apps/le-clap-expo/src/services/compile/CoreCompilationService.test.ts
git commit -m "feat(expo): abort signal cancels native run"
```

---

### Task 8: Build orchestrator + docs (H2 part 2)

**Files:**

- Create: `scripts/ffmpeg/build-engine.sh`
- Modify: `docs/on-device-compilation.md` (new "Building the engine locally" subsection under "Build toolchain")

- [ ] **Step 1: Create `scripts/ffmpeg/build-engine.sh`**

```bash
#!/usr/bin/env bash
# One-shot build of the on-device FFmpeg engine into the Expo module. The staged binaries
# (android jniLibs .so, ios LeclapFfmpegCore.xcframework) are NOT committed — this script is how
# they are (re)produced: FFmpeg deps + static libs per target, then the Rust engine on top.
# Usage: build-engine.sh [android|ios|all]   (default: all; ios requires macOS + Xcode)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODULE="$REPO_ROOT/apps/le-clap-expo/modules/leclap-ffmpeg"
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
```

Then: `chmod +x scripts/ffmpeg/build-engine.sh`

- [ ] **Step 2: Document it**

In `docs/on-device-compilation.md`, insert after the build-toolchain mermaid section (after line 123) :

````markdown
### Building the engine locally

The staged engine binaries (`modules/leclap-ffmpeg/android/src/main/jniLibs/*.so`,
`modules/leclap-ffmpeg/ios/LeclapFfmpegCore.xcframework`) are **not committed** — build them from
source (versions pinned in `scripts/ffmpeg/versions.env`):

```bash
# one-time prerequisites
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android \
  aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo install cargo-ndk   # android; also needs NDK 27.1 (see versions.env)

bash scripts/ffmpeg/build-engine.sh          # everything (~1 h cold)
bash scripts/ffmpeg/build-engine.sh android  # or one platform
```
````

````

Also update the "Key files" table row for the build toolchain to include `build-engine.sh`.

- [ ] **Step 3: Sanity-check + commit**

Run: `bash -n scripts/ffmpeg/build-engine.sh` (syntax check; a full run was already exercised piecewise in Tasks 5-6).

```bash
git add scripts/ffmpeg/build-engine.sh docs/on-device-compilation.md
git commit -m "chore: engine build orchestrator script"
````

---

### Task 9: Final verification sweep

- [ ] **Step 1: Engine** — from `packages/ffmpeg-engine/` (env from Task 2): `cargo test --release` → all pass (version, transcode+probe, re-entrancy, drawtext, fd-restore, cancel).
- [ ] **Step 2: App unit tests** — `cd apps/le-clap-expo && pnpm test` → all pass.
- [ ] **Step 3: Lint/types** — `pnpm lint && npx tsc --noEmit` → clean (no `eslint-disable`, no `else` introduced).
- [ ] **Step 4: Android** — `npx expo run:android`, spike screen `version()` = n8.0; readelf LOAD align `0x4000` on 64-bit ABIs.
- [ ] **Step 5: iOS** — device `xcodebuild` generic build SUCCEEDED; simulator app runs the spike screen.
- [ ] **Step 6: Hygiene** — `git status --porcelain | grep -E '\.(a|so)$|xcframework'` → empty (no binaries tracked or pending).
- [ ] **Step 7: End-to-end cancel** — in the app, start an on-device compile of a multi-clip template and abort it; UI returns "Compilation cancelled"/failed promptly instead of blocking to completion.

## Out of scope (deferred mediums from the audit)

Queue stuck-in-`processing` reconciliation (M2), iOS background-task wrapper (M1), intra-segment progress via `-progress` (M3), CI re-entrancy guard (M4), argv error sentinel (M5) — candidates for a follow-up branch.
