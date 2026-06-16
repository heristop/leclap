# @leclap/expo — LeClap mobile

Expo / React Native client for LeClap. It compiles videos **fully on-device** through an embedded native FFmpeg engine ([`ffmpeg-engine`](../../packages/ffmpeg-engine)) — no server — rendering the same [`@leclap/creative-kit`](../../packages/leclap-creative-kit) templates as the web app and CLI. Record a clip per template section from the camera, preview, then compile.

## Prerequisites

- **Node ≥ 24**, plus the repo toolchain (`mise install` from the root).
- A device/simulator, and **Xcode** (iOS) / **Android Studio** (Android) for native builds.

## Run

```bash
pnpm install            # from the repo root
pnpm start              # Metro dev server   (or: pnpm android · pnpm ios · pnpm web)
```

Everything runs locally — there is no backend to start. On an Android device/emulator, forward the Metro port for the dev client:

```bash
adb reverse tcp:8081 tcp:8081
```

## Notes

- **Routing** — Expo Router (file-based) under `app/`; feature modules under `src/features/` (editor, projects, templates).
- **Permissions** — camera + microphone (recording) and photo library (saving). Grant them in device settings if prompted.
- **Troubleshooting** — clear the cache with `npx expo start --clear`; for Android, re-run `adb reverse` after restarting Metro.

---

Part of the [LeClap monorepo](../../README.md). On-device pipeline: [On-Device Compilation](../../docs/on-device-compilation.md). MIT licensed.
