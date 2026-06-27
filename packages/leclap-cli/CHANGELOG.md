# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
