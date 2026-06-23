# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The package version is bumped to `2.0.0-beta.2`; this work is not yet published to npm
(the latest published prerelease is `2.0.0-beta.1`).

### Added

- Unified editor shell: one cross-kind element model with a single
  add / list / inspect panel, per-kind inspectors, canvas-less placement
  controls, and media overlay boxes on the section canvas.
- Capture modes (camera / screen / upload) across the web app, Expo, and the
  descriptor schema, with `captureMode` / `allowedCaptureModes` on project-video
  sections and a `useCaptureSession` hook.
- Multiple rushes (takes) per video section with a take chooser, and studio
  auto-save: every take persists to the project blob store, the in-progress
  draft resumes after a refresh, and the top bar shows save status with an
  unsaved-changes warning.
- Drag-and-drop authoring: drag library items and elements onto the section
  canvas, and drag to resize the preview/panel split on mobile.
- Build a custom template from scratch in the studio, with real variables and
  advanced panels, template-editor save-and-compile, and admin share/convert
  actions.
- Partials re-housed in the studio shell, with partial preview in the monitor,
  variable-name pre-fill, and template→partial conversion.
- Image overlays on color and image sections; timeline undo/redo with inverse
  operations.
- Copy any docs page as Markdown — or hand it straight to an AI assistant — from
  the documentation reader.
- Studio-themed controls: a scrubbable number input (used across every editor
  field) and a range slider with gradient fill and a playhead thumb.
- Animated icons throughout: an animated icon set with hover motion across every
  view, a magnetic stretch on the editor tool-dock indicator, and a logo "clap"
  on the header brand link.
- Search-match highlighting with animated gradient text, and a single animated
  gradient focus border shared across inputs.
- Creative kit: tutorial/launch templates, a flash-card partial, an expanded
  bundled music library, refreshed templates, and a square-promo template.
- Home marketing promo videos and showcases; mobile-responsive studio and
  template shells.
- Expo: media-library permission handling, plus recorder and preview refinements.
- MCP: square orientation in the compose guide.

### Changed

- `/studio` (gallery) split from `/studio/new` (editor) via `?template`, and
  `/templates` / `/projects` harmonized with the dark studio surface and poster
  cards.
- Project cards redesigned with hover-play motion and contained thumbnails; a
  dark header fill sits behind the studio shell.

### Fixed

- Surface the real FFmpeg error from the WASM log stream instead of the benign
  trailing `Aborted()`.
- Camera capture: stream leaks, recorder teardown, re-pick, and options
  memoization; deliver and autoplay the recorded take (confirm-gated).
- Stop the gradient heading clipping its descenders on the error page; drop the
  duplicate outer focus ring on inputs and the checkbox; show the gradient focus
  border on the number input.
- Refine doc Markdown table cells, tighten the mobile upload dropzone, fix the
  dark surface on the studio builder page, and correct export-panel typing.

## [2.0.0-beta.1] - 2026-06-19

### Added

- Overlay system end to end: overlay animations in the core, bundled overlay
  assets in the creative kit, overlay authoring in Expo, and an overlay editor
  in the web app.
- Refreshed bundled template catalog.
- Web: a phone showcase on the home page, per-route prerendered meta and a
  generated sitemap for SEO, a redesigned processor summary with a harmonized
  stop button, and saved onboarding renders.
- Expo: a scene timeline with richer template-editor fields, card-entrance and
  empty-state polish, and default-music pre-selection limited to one preview
  track.

### Changed

- **Breaking:** the CLI is no longer bundled in the core package — it ships
  separately as `@leclap/cli`, with a `leclap init` scaffolder, `citty`
  subcommands (`render`, `diagnose`), MCP + Remotion setup prompts, and quieter
  terminal output.
- MCP tools restructured, adding Remotion clip rendering.
- Configurable log level via `LECLAP_LOG_LEVEL`.
- Cloudflare Pages deploy: Node 24 pinned via `.node-version`, the build scoped
  to `leclap-web` via `wrangler.jsonc` with Workers static-assets config, the
  canonical domain switched to `leclap.pages.dev`, and the `_redirects` SPA rule
  dropped in favor of `not_found_handling`.
- Broad UI/UX polish and mobile rendering fixes across pages.

### Fixed

- Harden camera recording for mobile encoders and make the camera preview
  full-bleed on mobile.
- Fall back to the declared duration when ffprobe can't read a clip.
- Guard the postinstall build so the published package installs cleanly, and
  preserve CLI command errors.
- Tighten MCP local render access; harmonize mobile section spacing; match the
  phone-showcase frame to the demo-video aspect.

## [2.0.0-beta.0] - 2026-06-11

Upgrading from v1? See the [migration guide](packages/ffmpeg-video-composer/MIGRATION.md). The npm package name
is **unchanged** (`ffmpeg-video-composer`); the `le-clap`→`leclap` rename was
internal to the monorepo and does not affect consumers.

### Added

- `react-native` package entry (`ffmpeg-video-composer/reactnative`) and a
  dedicated `browser` entry, alongside the default Node entry.
- `TemplateDescriptorSchema` is now exported from the package entry for
  consumers that want to validate templates with the library's own Zod schema.
- On-device FFmpeg engine with in-flight run cancellation, exposed to JS and
  wired so an `AbortSignal` cancels the native run.
- iOS device build of the engine packaged as an `xcframework`.
- Engine build-from-source orchestrator (`scripts/ffmpeg/build-engine.sh`) plus
  tracked engine crate and FFmpeg toolchain sources.
- React Native target for the core library with native engine adapters and
  codec-aware segment rendering backed by a shared command parser.
- `CONTRIBUTING.md`, `SECURITY.md`, and GitHub issue/PR templates.
- Compile-mode settings screen and a template detail route outside the tabs.
- Local template catalog bundled from the server templates, with the sample
  clip bundled for the FFmpeg spike screen.

### Changed

- **Breaking:** `engines.node` now requires Node `>=24.11.0` (was `>=22.14.0`).
- **Breaking:** package layout reworked for publishing — the CLI is now
  `./dist/cli.js` (exposed as the `ffmpeg-video-composer` bin), the standalone
  `compile.js` / `diagnose.js` scripts are no longer shipped (use the CLI and
  its `--diagnose` flag), and the `./src/index` export was dropped (the `.`,
  `./browser`, and `./reactnative` entries remain). `prepack` builds `dist`.
- **Behavior:** FFmpeg is now invoked via `execFile` (no shell), and template
  string values used as ffmpeg argv tokens (color / url / section values) reject
  embedded whitespace and NUL — a template whose value contains a raw space now
  throws instead of silently injecting extra ffmpeg arguments.
- **Behavior:** server-side remote media fetches now enforce an SSRF guard —
  private/reserved/metadata IPs are rejected, redirects are re-validated per hop,
  and non-http(s) schemes are refused.
- Standardized naming on `leclap` across the monorepo (apps, packages, storage
  keys), renaming the server package to `server-app`. Internal only — invisible
  to npm consumers.
- Completed the cutover to the native engine, replacing the `ffmpeg-expo` plugin
  with an NDK config plugin and removing orphaned `ffmpegArgs`.
- Real application bundle id and env-driven web API URL.
- Refreshed documentation: structure tables, on-device engine references, and
  the on-device compilation architecture doc.

### Fixed

- Android 16 KB page alignment for the on-device engine.
- Panic-safe (RAII) file-descriptor restore in engine output capture.
- Reconcile stuck compilations on app startup.
- Guard against double-tap on record start and stop.
- Cleared pre-existing lint violations in the Expo app surfaced by the rename.

## [1.0.0] - 2025-10-11

### Added

- Expo playground app, later upgraded to Expo 54.
- Custom error types with detailed FFmpeg logs.
- `dependency-cruiser` for module-graph checks.

### Changed

- Migrated the build from tsup to tsdown for faster builds.
- Improved formatter speed management (#9).
- Reworked CLI error handling and process exit codes, and removed direct
  console logging from the director's error handling.
- Upgraded dependencies; added funding metadata.

## [0.3.0] - 2025-02-19

### Changed

- Dropped the bundled `ffmpeg-static` dependency.
- Applied the stone theme to the sample template.
- Documentation: added a Mermaid architecture graph and refreshed the feature
  list.

## [0.2.0] - 2024-09-07

### Changed

- Updated template asset URLs and the bundled sample.
- Updated dependencies.

## [0.1.1] - 2024-05-03

### Changed

- Maintenance release.

## [0.1.0] - 2024-05-01

### Added

- Initial release: an FFmpeg video composer with a director/compilation
  pipeline and a sample template.
- Custom output path on compilation.
