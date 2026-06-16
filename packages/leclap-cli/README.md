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
leclap diagnose           # check your FFmpeg setup
leclap --help             # usage (per-command help with `leclap <command> --help`)
leclap --version
```

`leclap <template.json>` is a shorthand for `leclap render <template.json>`.

`render` reads assets from `<cwd>/assets` and writes output under `<cwd>/build`.

## `init` — scaffold a project

`init` writes a minimal, immediately-renderable project: a no-external-media `template.json` (so the
first `render` just works), `package.json`, `README.md`, and `assets/`. It then **prompts** whether to
also set up:

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

## Standalone binaries

`pnpm build:exe` produces self-contained executables (Windows / macOS / Linux) under `dist/bin` via
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).
