# @leclap/expo — LeClap mobile

Expo / React Native client for LeClap. It renders videos **on-device** through an embedded native FFmpeg engine ([`ffmpeg-engine`](../../packages/ffmpeg-engine)) — no server — rendering the same [`@leclap/creative-kit`](../../packages/leclap-creative-kit) templates as the web app and CLI. Record a clip per template section from the camera, preview, then compile. Bundled assets are staged locally; remote assets can still require downloads.

## Engine configuration

The host stages assets and binds clips/form values into `ProjectConfig`, then injects the native
engine into `compileReactNative`. Descriptor `global.orientation` / `global.fps` determine output;
the app can forward `qualityTier`. Android selects `libopenh264`, iOS selects `h264_videotoolbox`,
both with AAC and serial segment rendering. Registered Remotion effects render on a separate
configured Node backend and must arrive as compatible clips. See [on-device host configuration](../../docs/on-device-compilation.md#host-configuration)
and the complete [engine configuration reference](../../docs/engine-configuration.md).

## Prerequisites

- **Node ≥ 24.11.0**, plus the repo toolchain (`mise install` from the root).
- A device/simulator and native dev client with the embedded engine; Expo Go does not include it.
- **Xcode** (iOS) / **Android Studio** (Android) for native builds. Rebuild the ignored engine binaries with `scripts/ffmpeg/build-engine.sh`; the current engine scripts assume macOS (including the Android NDK host toolchain). See [On-Device Compilation](../../docs/on-device-compilation.md#building-the-engine-locally).

## Run

```bash
pnpm install            # from the repo root
pnpm app:expo           # Metro dev server, from the repo root
pnpm app:android        # or pnpm app:ios, to build/run the native app
```

Everything runs locally — there is no backend to start. On an Android device/emulator, forward the Metro port for the dev client:

```bash
adb reverse tcp:8081 tcp:8081
```

## Notes

- **Routing** — Expo Router (file-based) under `app/`; feature modules under `src/features/` (editor, projects, templates).
- **Permissions** — camera + microphone (recording) and photo library (saving). Grant them in device settings if prompted.
- **Troubleshooting** — clear the cache with `pnpm --filter @leclap/expo exec expo start --clear`; for Android, re-run `adb reverse` after restarting Metro.

---

Part of the [LeClap monorepo](../../README.md). On-device pipeline: [On-Device Compilation](../../docs/on-device-compilation.md). MIT licensed.
