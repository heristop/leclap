# @leclap/cli

The LeClap command-line tool — the **human-facing** way to scaffold a video project and render it
locally on the [`ffmpeg-video-composer`](https://github.com/heristop/leclap) engine. You
write a JSON `template.json`, drop media in `assets/`, and `render` it to an mp4. `init` exists to take a
new user from nothing to a first render in one command.

## Quick start

```bash
pnpm dlx @leclap/cli init my-video   # scaffold a starter project (prompts for MCP + Remotion)
cd my-video
pnpm install
pnpm render                          # runs the scaffolded `leclap render template.json` script
```

## Commands

```bash
leclap init [name]        # scaffold a starter project (template.json + assets/ + README + scripts)
leclap render <template>  # compile a video from a template JSON
leclap validate <template> # check a template without rendering (schema + text layout)
leclap diagnose           # check your FFmpeg setup
leclap --help             # usage (per-command help with `leclap <command> --help`)
leclap --version
```

`leclap <template.json>` is a shorthand for `leclap render <template.json>`.

`render` reads assets from `<cwd>/assets` and writes output under `<cwd>/build`.

## `validate` — check before you render

`validate` checks a template against the schema without touching FFmpeg, then reads where the renderer
will draw every piece of text and warns about text that runs off the frame or out of title-safe,
collides with other text, sits under a band, is too small, lacks contrast, or sits over footage with no
box, outline or shadow. Each warning says what to change.

```bash
leclap validate template.json         # human report; exit 1 only for schema errors
leclap validate template.json --json  # { success, errors?, warnings? } for scripts and agents
```

Warnings never change the exit code, so `validate` is safe as a CI gate. At most 20 are shown, worst
first. Widths come from the real fonts; when a font is not bundled, `validate` fetches it from the
LeClap asset catalog (5s timeout) and, offline, falls back to an estimate marked `(approx: …)`.

## `init` — scaffold a project

`init` writes a minimal, immediately-renderable project: a no-external-media `template.json` (so the
first `render` just works), `package.json`, `README.md`, `assets/`, and a `pnpm-workspace.yaml` whose
`allowBuilds` lets pnpm 11+ run the `ffmpeg-static` download (npm, yarn and bun ignore it). It then
**prompts** whether to also set up:

- **the MCP server** (default Yes) — adds a project-scoped `.mcp.json` wiring [`@leclap/mcp`](../leclap-mcp)
  so an AI agent can author + render in this project (see below);
- **a Remotion starter** (default Yes) — adds a self-contained `remotion/` project (an `Intro`
  composition) for animated intros, plus the deps the MCP needs to render it.

Skip the prompts with flags (handy for scripts / CI — prompts also auto-default in a non-TTY):

```bash
leclap init my-video --yes                 # accept all defaults (MCP + Remotion)
leclap init my-video --no-mcp --no-remotion # bare CLI-render starter only
leclap init my-video --mcp --no-remotion    # MCP wiring, no Remotion
```

## Relation to `@leclap/mcp`

The CLI and the MCP are two front-ends to the **same** engine:

- **`@leclap/cli` — the manual/human path.** Scaffold + render `template.json` on disk yourself.
- **[`@leclap/mcp`](../leclap-mcp) — the agent path.** An AI agent authors, validates, and renders the
  same descriptors over MCP, inside your own project. A `template.json` from `leclap init` is equally
  usable by the MCP's `compose_video`.

Animated intros are **bring-your-own Remotion**: the MCP's `render_remotion_clip` renders a composition
from _your_ Remotion project (the `remotion/` starter, when you opt in) to a clip, which `compose_video`
composites in front of your scenes. Remotion is optional and design-time only (headless Chromium); the
CLI itself never needs it.

> The generated `.mcp.json` uses absolute env paths (this machine). Regenerate or edit them if you move
> the project.

## FFmpeg

The engine resolves FFmpeg in this order: system FFmpeg (fastest) → `ffmpeg-static` → `@ffmpeg/ffmpeg`
(WASM). Run `leclap diagnose` to see what your environment provides.

`ffmpeg-static` ships `ffmpeg` but no `ffprobe`. Templates with transitions, music, whole-video overlays
(`global.animations`, `global.watermark`) or `project_video` clips need an ffprobe to read their media,
so on that path LeClap looks for one in two places:

- the optional `ffprobe-static` package (large: it bundles a binary for every platform);
- an `ffprobe` next to the `ffmpeg-static` binary, for example when `FFMPEG_BIN` points at an FFmpeg
  build that ships both.

With neither, the render stops before encoding anything. The reason, which names the missing binary
and how to install it, is written to the render log (`build/render.log`).

Installing FFmpeg (`brew install ffmpeg`, `sudo apt install ffmpeg`) provides both binaries, and
LeClap then uses it instead of `ffmpeg-static`. For templates that draw text, that FFmpeg needs the
`drawtext` filter.

## Standalone binaries

`pnpm build:exe` produces self-contained executables (Windows / macOS / Linux) under `dist/bin` via
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).
