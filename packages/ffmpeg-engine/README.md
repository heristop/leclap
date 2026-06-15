# leclap-ffmpeg-core

The **on-device FFmpeg engine**: a Rust crate that statically links FFmpeg's own
command-line tools (`fftools` — `ffmpeg.c` / `ffprobe.c`) and exposes them to the
[`leclap-expo`](../../apps/leclap-expo) app as in-process `run` / `probe` / `version` calls.
No subprocess, no `.so` to resolve at runtime, no network — the same FFmpeg that renders on
the server runs **inside the phone**, so a template compiles to an mp4 fully offline.

This is the **runtime half** of on-device compilation. The **build half** lives in
[`scripts/ffmpeg/`](../../scripts/ffmpeg), which compiles FFmpeg + deps into the static libs
this crate links against. Full architecture:
[`docs/on-device-compilation.md`](../../docs/on-device-compilation.md).

## How it fits together

```text
template JSON
  → ffmpeg-video-composer (reactnative.ts)         build the ffmpeg argv
  → FFmpegLeclapAdapter                              core ⇄ engine boundary
  → leclap-ffmpeg Expo module (Kotlin / Swift)       JS → native
  → leclap_ffmpeg_core  (THIS crate, via uniffi)     native → FFmpeg
  → libfftools.a + static FFmpeg libs                the actual encode
```

The crate is built into the Expo native module — `jniLibs/*.so` on Android, a
`LeclapFfmpegCore.xcframework` on iOS — by
[`scripts/ffmpeg/build-engine.sh`](../../scripts/ffmpeg/build-engine.sh). Those binaries are
**not committed**; that script is how they are (re)produced.

## Public API (uniffi → Kotlin / Swift)

| Symbol                                        | Purpose                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run(args) -> RunResult { code, log }`        | Run one ffmpeg command (argv without the program name). Output goes to the file(s) named in `args`; `log` is the captured stderr — the reason on failure. |
| `probe(args) -> ProbeResult { code, output }` | Run ffprobe, capturing **stdout** (JSON when called with `-print_format json`).                                                                           |
| `cancel()`                                    | Cooperatively stop the in-flight `run` (like one SIGTERM — the transcode loop exits, `run` returns 255). No-op if nothing is running.                     |
| `version() -> String`                         | The linked FFmpeg version string (e.g. `"8.0"`).                                                                                                          |
| `ARGV_ERROR = -2`                             | Sentinel `code` for malformed `args` (empty, or an interior NUL byte) — distinct from any code ffmpeg itself returns.                                     |

`fftools` keep parse/transcode state in process globals and write to the shared stdout/stderr
fds, so **only one invocation runs at a time** (`ENGINE_LOCK`); the core issues commands
sequentially. `run`/`probe` redirect the C-level fd 1/2 to a temp file to capture output
in-process, restoring it even across a panic.

## Layout

| Path                        | Role                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib.rs`                | The engine: argv validation, fd-capture, `run`/`probe`/`cancel`/`version`, uniffi scaffolding.            |
| `csrc/ffmpeg_shim.c`        | C bridge — prepends `argv[0]` and forwards to the renamed `ffmpeg_main` / `ffprobe_main`.                 |
| `build.rs`                  | Compiles the shim and statically links `libfftools.a` + FFmpeg + freetype (via `FFMPEG_PKG_CONFIG_PATH`). |
| `src/bin/uniffi-bindgen.rs` | Generates the Kotlin/Swift bindings (output checked in under `bindings/`).                                |
| `build-android-jni.sh`      | Cross-builds the `.so` for every Android ABI into the Expo module's `jniLibs/`.                           |
| `build-ios-lib.sh`          | Builds the per-slice static libs and assembles the iOS `xcframework`.                                     |
| `.cargo/config.toml`        | Android 16 KB page-size link tuning (Play requirement for 64-bit ABIs).                                   |
| `tests/`                    | `cargo test` runs `run`/`probe`/`cancel` against a host static FFmpeg build.                              |

## Build & test

```bash
# Whole engine into the Expo module (FFmpeg deps + static libs + this crate):
bash scripts/ffmpeg/build-engine.sh [android|ios|all]

# Unit tests against a host build (no device needed):
cargo test                      # from this directory
```

LGPL-3.0-or-later (no `--enable-gpl` in the FFmpeg build — see
[`scripts/ffmpeg/common.sh`](../../scripts/ffmpeg/common.sh)).

---

Part of the [LeClap monorepo](../../README.md). On-device pipeline: [On-Device Compilation](../../docs/on-device-compilation.md).
