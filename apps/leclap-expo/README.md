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

If Metro uses another port, forward that port instead and update **Change Bundle Location** in the
Android developer menu. An installed dev client can retain the address from a previous session.

## Native build checks

After staging the engine binaries, generate the native projects with
`pnpm --filter @leclap/expo exec expo prebuild --no-install`, then install iOS pods with
`pod install --project-directory=apps/leclap-expo/ios`. The `withIosDeploymentTarget` config plugin
raises dependency targets to the app's iOS deployment floor (16.4 by default), preserving higher
requirements. This also fixes older dependency privacy bundles rejected by Xcode 27. Keep the
lockfile: `expo-modules-jsi` 56.0.14 includes the Swift callback fix required by this toolchain.

From the repository root, an Android ARM64 debug build and an unsigned iOS ARM64 simulator build are:

```bash
(cd apps/leclap-expo/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a)
xcodebuild -workspace apps/leclap-expo/ios/LeClap.xcworkspace -scheme LeClap \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```

These compile the app against the staged engine; they do not rebuild FFmpeg or Rust. To check video
compilation, run the dev client, complete a template's text and clip steps, then select **Create My
Video**. Confirm that the result plays with its animated text and audio. The `leclap://ffmpeg-spike`
route only exercises raw native FFmpeg commands; it does not verify the template composition flow.

## Notes

- **Routing** — Expo Router (file-based) under `app/`; feature modules under `src/features/` (editor, projects, templates).
- **Permissions** — camera + microphone (recording) and photo library (saving). Grant them in device settings if prompted.
- **Troubleshooting** — clear the cache with `pnpm --filter @leclap/expo exec expo start --clear`; for Android, re-run `adb reverse` after restarting Metro.

---

Part of the [LeClap monorepo](../../README.md). On-device pipeline: [On-Device Compilation](../../docs/on-device-compilation.md). MIT licensed.
