# @leclap/cli

The LeClap command-line tool — scaffold a project and compile videos from JSON templates. Built on
[`ffmpeg-video-composer`](https://github.com/heristop/ffmpeg-video-composer).

## Quick start

```bash
npx @leclap/cli init my-video     # scaffold a starter project
cd my-video
npx @leclap/cli render template.json
```

## Commands

```bash
leclap init [name]        # scaffold a starter project (template.json + assets/ + README + scripts)
leclap render <template>  # compile a video from a template JSON
leclap diagnose           # check your FFmpeg setup
leclap --help             # usage (per-command help with `leclap <command> --help`)
leclap --version
```

`leclap <template.json>` is a shorthand for `leclap render <template.json>`.

Install globally to get the `leclap` command:

```bash
npm i -g @leclap/cli
leclap init my-video
```

`render` reads assets from `<cwd>/assets` and writes output under `<cwd>/build`.

## FFmpeg

The engine resolves FFmpeg in this order: system FFmpeg (fastest) → `ffmpeg-static` → `@ffmpeg/ffmpeg`
(WASM). Run `leclap diagnose` to see what your environment provides.

## Standalone binaries

`pnpm build:exe` produces self-contained executables (Windows / macOS / Linux) under `dist/bin` via
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).
