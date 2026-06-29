# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-06-29

### Added

- `TemplateValidator` (plus `ValidationResult` / `ValidationError` types) is now
  exported from the entry, so consumers can validate a descriptor without compiling.

## [2.1.0] - 2026-06-29

### Added

- `compile()` accepts an optional `CompileReporter` (`onProgress(fraction)` +
  `onLog(line)`) for live compilation progress and forwarded engine logs; the
  Node and browser entries share the same listener wiring.
- Partial-expansion mechanism and font registry now ship in the engine
  (`findFont`, `expandPartials`/`expandPartialsSafe`, exported from the entry),
  with a `TemplatePartialSchema` and an optional `partials` field on the root
  descriptor schema. Partials travel with the descriptor (`descriptor.partials`).
- Asset-source helpers (`assetBaseUrl`/`fontAssetUrl`/`musicAssetUrl`/
  `catalogAssetUrl`) resolving catalog media to the public repository.

### Changed

- Fonts and music are no longer bundled in the package — `dist/fonts` and
  `dist/musics` (~106 MB) are gone, dropping the install size to ~1 MB. Catalog
  fonts (by registry id), tracks referenced by name, and catalog media
  (`videos/…`, `pictures/…`) are fetched on demand from the public LeClap
  repository; the base URL is overridable via `FVC_ASSET_BASE_URL`. Standard font
  families still fall back to Google Fonts, and an explicit music `url` is used
  as-is.
- The package no longer depends on the private `@leclap/creative-kit`; a catalog
  supplies its shared partials by merging them into `descriptor.partials` before
  compiling.

### Fixed

- Generated type declarations: the `TextEffect` type is no longer emitted as a
  dangling `TextEffect$1` alias, so `dist/index.d.ts` typechecks cleanly for
  consumers (previously `error TS2552`).

### Removed

- Dropped unused `boxen`, `cli-spinners`, `figlet`, `gradient-string`, and
  `pino-pretty` dependencies (CLI cosmetics that moved to `@leclap/cli`).

## [2.0.0] - 2026-06-27

Stable release of the 2.0.0 line (consolidates the `2.0.0-beta.*` prereleases).

Upgrading from v1? See the [migration guide](MIGRATION.md). The npm package name
is **unchanged** (`ffmpeg-video-composer`); the `le-clap`→`leclap` rename was
internal to the monorepo and does not affect consumers.

### Added

- Multi-platform package entries: a `react-native` entry
  (`ffmpeg-video-composer/reactnative`) and a dedicated `browser` entry alongside
  the default Node entry, with native engine adapters and codec-aware segment
  rendering backed by a shared command parser.
- On-device FFmpeg engine with in-flight run cancellation (an `AbortSignal`
  cancels the native run), an iOS `xcframework` build, Android 16 KB page
  alignment, and a build-from-source orchestrator
  (`scripts/ffmpeg/build-engine.sh`) with tracked engine crate and FFmpeg
  toolchain sources.
- `TemplateDescriptorSchema` exported from the package entry for consumers that
  want to validate templates with the library's own Zod schema.
- Effect sugar: `text` (reveal / title-card / lower-third), `lut3d` colour looks,
  `chromaKey`, and `overlayMotion` effects, backed by compiler registries and
  global descriptor decorations; animated text can exit as well as reveal.
- Overlay system: overlay animations in the core engine with bundled overlay
  assets in the creative kit.
- Descriptor schema: `captureMode` / `allowedCaptureModes` (camera / screen /
  upload) on project-video sections.
- Performance: parallel segment rendering, automatic hardware H.264 encoder
  selection (VideoToolbox / MediaCodec) when available, and a perf-timer plus
  bench harness instrumenting the compile pipeline.
- bt709 colour metadata on re-encoded output, and validation that flags unknown
  caption and overlay fonts.
- Creative kit: refreshed bundled template catalog and an expanded music
  library, with tutorial / launch and square-promo templates and a flash-card
  partial.
- `CONTRIBUTING.md`, `SECURITY.md`, and GitHub issue/PR templates.

### Changed

- **Breaking:** `engines.node` now requires Node `>=24.11.0` (was `>=22.14.0`).
- **Breaking:** the CLI is no longer bundled in the core package — it ships
  separately as `@leclap/cli`.
- **Breaking:** package layout reworked for publishing — the standalone
  `compile.js` / `diagnose.js` scripts are no longer shipped (use `@leclap/cli`),
  and the `./src/index` export was dropped (the `.`, `./browser`, and
  `./reactnative` entries remain). `prepack` builds `dist`.
- **Behavior:** FFmpeg is now invoked via `execFile` (no shell), and template
  string values used as ffmpeg argv tokens (color / url / section values) reject
  embedded whitespace and NUL — a template whose value contains a raw space now
  throws instead of silently injecting extra ffmpeg arguments.
- **Behavior:** server-side remote media fetches now enforce an SSRF guard —
  private/reserved/metadata IPs are rejected, redirects are re-validated per hop,
  and non-http(s) schemes are refused.
- Performance: cut redundant finalize re-encode passes by folding single-segment
  concat and fusing the xfade + animation-overlay graphs into one pass.
- Completed the cutover to the native engine, replacing the `ffmpeg-expo` plugin
  with an NDK config plugin and removing orphaned `ffmpegArgs`.
- Configurable log level via `LECLAP_LOG_LEVEL`.
- Refreshed documentation: on-device engine references and the on-device
  compilation architecture doc.

### Fixed

- Surface the real FFmpeg error from the WASM log stream instead of the benign
  trailing `Aborted()`.
- Add silent audio to video-only clips so transitions don't abort, and cap xfade
  transition duration to prevent short-clip collapse.
- Fall back to the declared duration when ffprobe can't read a clip.
- Make the perf-timer browser-safe, derive WASM compile progress from elapsed
  time, and drop ineffective dynamic imports in the Node entry.
- Panic-safe (RAII) file-descriptor restore in engine output capture.
- Guard the postinstall build so the published package installs cleanly.

## [1.0.0] - 2025-10-11

### Added

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
