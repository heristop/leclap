# Expo review evidence — PR #73

Captured on 2026-10-03 after the Expo polish at `ef8c86f9` and its export review fixes in `22a62769`. These are public project assets and synthetic test media; no private recordings or user projects are included.

## UI snapshots and video

The JPEGs are unmodified browser screenshots of the actual React Native components rendered through React Native Web in a temporary fixture. They are **not native device screenshots**. Phone viewport: 390×844; tablet: 768×1024. Fonts, translations, SVG mascot and posters come from the app.

- `gallery-phone.jpg` / `gallery-tablet.jpg`: production Header, TemplateList and CustomTabBar with the ten bundled templates. The fixture supplies catalog data and inert navigation; it does not mount the full routed Scenarios screen or its Create action.
- `search-phone.jpg`: entered “portrait” through the real search control; focused input retained and one matching template shown.
- `empty-search-phone.jpg`: entered “unmatched”; the actual clear-search control restored ten results.
- `export-phone.jpg` / `upload-phone.jpg`: production ExportSheet with a fixture output URI. Opening the actual disclosure reveals the URL field and a disabled empty-URL upload action; Close dismisses the sheet. Save, system Share and a real upload were not invoked in the browser.
- `render-phone.jpg`: production CompileProgressOverlay driven by its real Zustand store with controlled 42% progress. Cancel invokes the fixture cancellation callback and closes the overlay. This does not represent a timed engine render.
- `ui-snapshot-walkthrough.mp4`: **14.4-second snapshot slideshow**, six real phone captures held for 2.4 seconds each. Captions identify the fixture states. It is not a continuous screen recording and does not demonstrate animation timing. H.264, 480×960, 30 fps, no audio.

Browser captures verify layout, filtering, disclosure and cancellation callbacks. They do not verify native permission/share sheets, safe areas, keyboard avoidance, VoiceOver/TalkBack or system text scaling.

## Native engine outputs

`native-android-render.mp4` and `native-ios-render.mp4` were generated on the Android ARM64 emulator and iOS simulator during the SDK 57 verification at `57336845`, before the UI polish. The same JSON smoke composition uses a synthetic chart, title text and authored audio. Each is approximately three seconds, H.264/AAC, 1280×720 at 30 fps. These demonstrate on-device engine output, not native UI interaction or the new sharing flow.

The media is stored as compact ordinary Git blobs under the existing `.github/media/**` exemption. PR links can be pinned to the evidence commit, avoiding expired temporary URLs and the repository's exhausted LFS budget.

## Review and build verification

An independent review found three issues: the export sheet was not connected to the routed preview, Android text sharing did not attach the video, and completed export state persisted across output changes. All three were fixed; the independent re-review reported no further actionable defects.

Fresh checks on the fixes: 232 Expo tests across 32 suites (six added component regressions), Expo typechecking, ten poster checks, changed-source formatting/lint, SDK dependency compatibility and production Hermes exports for iOS/Android passed. The existing preview seek immutability warning remains.

Native rebuilding with `expo-sharing` also passed: Android ARM64 debug APK and iOS ARM64 simulator Debug app on Xcode 27. Disk exhaustion interrupted the initial simultaneous attempts; retrying after cleaning generated Xcode output succeeded. The iOS retry disabled debug symbols to reduce disk use (`GCC_GENERATE_DEBUGGING_SYMBOLS=NO DEBUG_INFORMATION_FORMAT=`) and did not require signing. Build success does not establish native system-sheet interaction or accessibility verification.
