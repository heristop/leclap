# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0-beta.0] - 2026-06-11

Upgrading from v1? See the [migration guide](MIGRATION.md). The npm package name
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
