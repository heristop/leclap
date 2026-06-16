# @leclap/cli

The LeClap command-line interface — compile a video from a JSON template with your system FFmpeg. A
thin wrapper over [`ffmpeg-video-composer`](https://github.com/heristop/ffmpeg-video-composer).

## Usage

```bash
npx @leclap/cli my-template.json    # compile a video from a template
npx @leclap/cli --diagnose          # check your FFmpeg setup
npx @leclap/cli --help              # usage
npx @leclap/cli --version           # version
```

Install it globally to get the `leclap` command:

```bash
npm i -g @leclap/cli
leclap my-template.json
```

The CLI looks for assets in `<cwd>/assets` and writes output under `<cwd>/build`.

## FFmpeg

The engine resolves FFmpeg in this order: system FFmpeg (fastest) → `ffmpeg-static` → `@ffmpeg/ffmpeg`
(WASM). Run `--diagnose` to see what your environment provides.

## Standalone binaries

`pnpm build:exe` produces self-contained executables (Windows / macOS / Linux) under `dist/bin` via
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).
