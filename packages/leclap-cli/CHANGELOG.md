# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-08-13

### Changed

- Refreshed the build toolchain (`@yao-pkg/pkg`, `tsdown`, `tsx`) and dropped a
  redundant cast in `leclap validate`. No user-facing behaviour changes.

## [0.2.1] - 2026-07-24

### Fixed

- Restore the terminal cursor on Ctrl-C during a render — interrupting a render no
  longer leaves the shell with a permanently hidden cursor.
- Keep `leclap render --watch` alive when an OS-level file-watcher error occurs (editor
  rename/replace, `EMFILE`, the watched dir being removed) instead of crashing the process.
- `--json` mode now emits a machine-readable `{ "ok": false, "error": … }` object on
  failure (missing template, bad `--field`/`--video`) instead of coloured stderr text.
- Count physical terminal rows when repainting, so a progress header that wraps on a
  narrow terminal no longer corrupts the live render block.

## [0.2.0] - 2026-06-29

### Added

- `leclap validate <template.json>` — validates a template against the engine schema
  and semantic rules without rendering; path-pointed errors, exit 1 on failure,
  `--json` for a machine-readable result.
- `leclap render` input flags: `-o, --output` (copy the result to a path), repeatable
  `--field key=value` (template variables / form fields) and `--video section=path`
  (project_video inputs), `--locale`, `--orientation`, and `--assets` / `--build`
  directory overrides. Previously only fully-static templates could be rendered.
- `leclap render --watch` re-renders on template/asset changes until Ctrl-C; a failed
  pass is reported but never stops the watcher.
- `leclap render --json` (machine-readable `{ ok, output, bytes, durationMs }`) and
  `-q, --quiet` (final summary only) for CI/scripting.
- Live render progress: an in-place region with a spinner, progress bar, percent,
  elapsed time, and a streaming tail of the latest engine/ffmpeg log lines
  (driven by the engine's new `CompileReporter`); collapses to a one-line summary
  on success and leaves the failing context on screen on error.
- A cohesive "marquee / clapperboard" terminal theme, with the wordmark title in a
  lavender → pink gradient mirroring the web `brand-gradient` (per-glyph on truecolor
  terminals, single-hue fallback elsewhere); status colour reserved for meaning.

### Changed

- Requires `ffmpeg-video-composer` 2.1.1 (the `validate` command uses its exported
  `TemplateValidator`); fonts, music, and catalog media are fetched on demand from
  the public repository (nothing bundled).
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
