# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Standardized naming on `leclap` across the monorepo (apps, packages, storage
  keys), renaming the server package to `server-app`.
- Reworked the core into a publishable npm package layout under the
  `ffmpeg-video-composer` name.
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
