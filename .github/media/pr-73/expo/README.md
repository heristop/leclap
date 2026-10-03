# Expo review evidence — PR #73

Captured on 2026-10-03 after the Expo polish at `ef8c86f9` and its export review fixes in `22a62769`. These are public project assets and synthetic test media; no private recordings or user projects are included.

## UI snapshots and video

The JPEGs are unmodified browser screenshots of the actual React Native components rendered through React Native Web in a temporary fixture. They are **not native device screenshots**. Phone viewport: 390×844; tablet: 768×1024. Fonts, translations, SVG mascot and posters come from the app.

- `gallery-phone.jpg` / `gallery-tablet.jpg`: refreshed after equalizing card heights within each row on phone and tablet, using natural content height rather than a fixed clipped height. Production Header, TemplateList and CustomTabBar with the ten bundled templates. The fixture supplies catalog data and inert navigation; it does not mount the full routed Scenarios screen or its Create action.
- `search-phone.jpg`: refreshed after removing the duplicate browser focus outline; Tab/Shift+Tab returns to the input with the enclosing lavender border still visible. Entered “portrait” through the real search control; focused input retained and one matching template shown.
- `empty-search-phone.jpg`: entered “unmatched”; the actual clear-search control restored ten results.
- `export-phone.jpg` / `upload-phone.jpg`: production ExportSheet with a fixture output URI. Opening the actual disclosure reveals the URL field and a disabled empty-URL upload action; Close dismisses the sheet. Save, system Share and a real upload were not invoked in the browser.
- `render-phone.jpg`: production CompileProgressOverlay driven by its real Zustand store with controlled 42% progress. Cancel invokes the fixture cancellation callback and closes the overlay. This does not represent a timed engine render.
- `export-tablet.jpg`: refreshed motion pass, centered 640-point sheet with URL disclosure at 768×1024.
- `clappy-react-commits.jpg`: diagnostic component fixture, one measured React Profiler commit when switching welcome to success; the wrapper animation schedules no per-frame React updates. This is not an FPS or native device benchmark.
- `ui-snapshot-walkthrough.mp4`: **14.4-second snapshot slideshow from the earlier polish**, six real phone captures held for 2.4 seconds each. Captions identify the fixture states. It is not a continuous screen recording and does not demonstrate animation timing. H.264, 480×960, 30 fps, no audio.

Browser captures verify layout, filtering, disclosure and cancellation callbacks. They do not verify native permission/share sheets, safe areas, keyboard avoidance, VoiceOver/TalkBack or system text scaling.

## Native engine outputs

`native-android-render.mp4` and `native-ios-render.mp4` were generated on the Android ARM64 emulator and iOS simulator during the SDK 57 verification at `57336845`, before the UI polish. The same JSON smoke composition uses a synthetic chart, title text and authored audio. Each is approximately three seconds, H.264/AAC, 1280×720 at 30 fps. These demonstrate on-device engine output, not native UI interaction or the new sharing flow.

The media is stored as compact ordinary Git blobs under the existing `.github/media/**` exemption. PR links can be pinned to the evidence commit, avoiding expired temporary URLs and the repository's exhausted LFS budget.

## Review and build verification

An independent review found three issues: the export sheet was not connected to the routed preview, Android text sharing did not attach the video, and completed export state persisted across output changes. All three were fixed; the independent re-review reported no further actionable defects.

Fresh checks on the fixes: 232 Expo tests across 32 suites (six added component regressions), Expo typechecking, ten poster checks, changed-source formatting/lint, SDK dependency compatibility and production Hermes exports for iOS/Android passed. The existing preview seek immutability warning remains.

Native rebuilding with `expo-sharing` also passed: Android ARM64 debug APK and iOS ARM64 simulator Debug app on Xcode 27. Disk exhaustion interrupted the initial simultaneous attempts; retrying after cleaning generated Xcode output succeeded. The iOS retry disabled debug symbols to reduce disk use (`GCC_GENERATE_DEBUGGING_SYMBOLS=NO DEBUG_INFORMATION_FORMAT=`) and did not require signing. Build success does not establish native system-sheet interaction or accessibility verification.

## Responsive motion refinement

Clappy now uses finite 510 ms reactions, transform-only UI-thread animation, a shared live accessibility/foreground subscription and focus/compile guards. Presses activate immediately with interruptible feedback; tab indicator fades do not move layout, and engine progress scales a full-width bar from the left. The tablet sheet is centered and capped at 640 points. Gallery, empty search, tablet export, render cancellation and the diagnostic mascot captures were refreshed in this pass.

Independent review identified Reanimated’s cached startup preference and Tamagui’s fallback spring for an undefined transition. Guarded animations now explicitly select `ReduceMotion.Never`, and reduced/inactive buttons use `0ms`. Re-review found no remaining actionable findings. Fresh validation: 245 Expo tests in 34 suites, Expo typechecking, changed-source lint/format, and iOS/Android production Hermes exports. Compared with the earlier export, Hermes bytecode increased by 9,368 bytes on iOS (0.114%) and 6,295 bytes on Android (0.075%). No dependencies were added. Native frame-rate, gesture responsiveness and thermal behavior still require device profiling.

## iOS JSON compilation check — 2026-10-03

`ios-json-e2e.png` captures the native diagnostic screen on iPhone 17 Pro / iOS 26.5 Simulator after two consecutive production JSON compilations. `ios-json-e2e.mp4` is the second native output: 3.023 seconds, H.264/AAC, 1280×720, 30 fps. The bundled synthetic footage, rising title/caption, pulse motion and music compile entirely on-device. Both native probes passed; the copied output also decoded with host FFmpeg without errors. Playback was visually verified in the native player after enabling autoplay in the diagnostic screen.

This checks the diagnostic deep-link → production composition → native probe → video preview path. It does not verify camera capture, the gallery editor/export flow, or a physical iPhone.

`ios-launcher.png` shows the revised launcher on the simulator home screen after a successful Xcode Debug build and reinstall. The icon uses the full-bleed gradient, larger clapper and platform corner mask.

## Native iOS permission checks — 2026-10-03

- `ios-camera-permission.png` and `ios-microphone-permission.png`: native first-use prompts on iPhone 17 Pro / iOS 26.5 after recovering the simulator privacy service. Camera was denied and microphone allowed.
- `ios-recording-permission-denied.png`: camera denial blocks recording and shows the Settings recovery action; the heading now covers both recording permissions.
- A clean iPhone 16 Pro / iOS 18.6 installation also showed both native prompts. Allowing camera and denying microphone blocked recording. `ios-permission-settings.png` shows that combination in Settings. After enabling microphone in Settings and returning to the app, reopening the recorder cleared the permission gate; `ios-permission-granted.png` shows the simulator hardware limitation instead.

The iOS 26.5 simulator initially rejected requests with `Database failed to open during _doEval` in tccd logs. Rebuilding with normal simulator signing alone did not fix it; shutting down and booting the simulator restored its privacy database access and native prompts. No privacy database was edited and no permission was forced with a grant command. The standard React Native Settings action opened Settings, requiring manual navigation to Apps → LeClap in these simulator tests.

These checks verify prompts, both denial combinations, persisted Settings values and permission-gate clearing after a Settings change/relaunch. They do not prove live camera capture on physical hardware or an uninterrupted AppState-only refresh: iOS relaunched the app after changing microphone access.

After a supported reset, the iOS 26.5 simulator also passed the both-granted case through its native Allow buttons; `ios26-permission-granted.png` shows that the permission gate clears and only the missing simulator camera hardware remains. Both permissions are left enabled on the main simulator. All 245 Expo tests passed after the localized heading/checking-copy update.
