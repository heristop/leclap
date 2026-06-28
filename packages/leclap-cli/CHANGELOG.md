# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-29

### Added

- Live render progress: an in-place region with a spinner, progress bar, percent,
  elapsed time, and a streaming tail of the latest engine/ffmpeg log lines
  (driven by the engine's new `CompileReporter`); collapses to a one-line summary
  on success and leaves the failing context on screen on error.
- A cohesive "marquee / clapperboard" terminal theme (single warm amber accent;
  status colour reserved for meaning).

### Changed

- Targets `ffmpeg-video-composer` 2.1.0: fonts, music, and catalog media are
  fetched on demand from the public repository (nothing bundled).
- `leclap init` now detects the package manager (npm / pnpm / yarn / bun) and
  prints matching install/run steps, pins `@leclap/cli` to the current version
  (a bare `^0.1.0` excluded `0.2.0`), tracks `@leclap/mcp` and Remotion at
  `latest`, and approves pnpm's native builds so `ffmpeg-static` unpacks.

## [0.1.0] - 2026-06-27

Initial release. The CLI was extracted from `ffmpeg-video-composer` into its own
`@leclap/cli` package.

### Added

- `leclap` binary with [citty](https://github.com/unjs/citty) subcommands:
  `render` (compile a video from a JSON template) and `diagnose`.
- `leclap init` project scaffolder, with prompts to set up the MCP server and
  Remotion.
- Quiet, consistent terminal output.
- Command errors are preserved and surfaced with the right exit code.
