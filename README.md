<div align="center">

# 🎬 LeClap

**Deterministic, on-device, agent-callable video — composed by prompt or by hand.**

Describe a video in one JSON _template_ — sections, filters, music, overlays — then render the **same template identically** on a phone (React Native, **on-device**), in the **browser** (WebAssembly), or on a server. No upload, no server, no generative model: the output is deterministic and reproducible. Author it two ways — an **AI agent** composes one from a prompt (MCP), or a person customizes one in the **visual builder**.

[![CI](https://github.com/heristop/ffmpeg-video-composer/actions/workflows/ci.yml/badge.svg)](https://github.com/heristop/ffmpeg-video-composer/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/en/)
[![pnpm](https://img.shields.io/badge/pnpm-11-f69220.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Demo](#-demo) · [Quick start](#-quick-start) · [Templates](docs/template-configuration.md) · [Library](#-using-the-library) · [Docs](#-documentation)

</div>

---

## ✨ What is LeClap?

LeClap renders video from a single JSON _template_: the same spec — sections, filters, music, text overlays — runs on a server, in the browser via WebAssembly, and fully **on-device** on React Native, with no upload and no server required. The on-device mobile engine (a Rust core statically linking a patched FFmpeg) is the standout capability — it keeps the whole compile on the phone, where the old `ffmpeg-kit-react-native` go-to was archived in 2025.

Its uncontested corner is **deterministic + on-device + agent-callable** video — where Sora/Runway (generative, server-bound) and Remotion/Shotstack (need a backend) can't reach. The full loop runs on the device: **record a clip straight from the camera, apply effects, mix in music, add transitions, and render a finished video** — captured, edited, and composed on the phone (or in a browser tab), no upload. A bundled pack of **premium templates** (cinematic title cards, typographic quote cards, social reels) makes that look professional out of the box, using only the filters and fonts that ship in the engine, so a phone, a browser tab, and a server all produce the same result.

It ships as a **monorepo**: at its core is the [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) library (published to npm, usable standalone). Around it sit an [MCP server](packages/mcp) (the engine as agent-callable tools), an HTTP server, and web + mobile apps that demonstrate it end to end.

|                                   |                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 🧩 **Template-driven**            | One JSON descriptor → a complete video. No imperative FFmpeg wrangling.                                                    |
| 🌍 **Runs everywhere**            | Node.js, browser (WASM), React Native, Electron — one codebase, identical output.                                          |
| 📹 **Capture → compose → render** | Record from the camera, trim/crop, mix music, add transitions, and render — captured, edited, and composed on-device.      |
| 🤖 **Agent-callable**             | An [MCP server](packages/mcp) lets an AI agent author & render a template — no LLM in the loop, just deterministic output. |
| 🎨 **Premium out of the box**     | A bundled pack of polished, on-device-safe templates — author by prompt or in the visual builder.                          |
| 🎚️ **Composable pipeline**        | Per-section `inputs → maps → filters` for real compositing, text, and audio mixing.                                        |
| 🧱 **Typed & validated**          | Zod-validated templates, strict TypeScript, dependency-injected architecture.                                              |

## 🎥 Demo

See `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

<img src="https://github.com/heristop/ffmpeg-video-composer/raw/main/docs/leclap.gif" alt="LeClap mobile app" width="280" align="right" />

## 🚀 Quick start

> 💡 **Recommended: [mise](https://mise.jdx.dev).** A single `mise install` provisions the exact pinned toolchain this repo expects — **Node 24, pnpm 11, FFmpeg 8.1.1** (a full build _with_ the `drawtext` filter), and the **Rust** toolchain — so every contributor and CI run identical versions. It's the simplest, most reliable way to get set up.

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
mise install     # provisions Node 24, pnpm 11, FFmpeg 8.1.1 (with drawtext) + Rust
pnpm install     # wires up every workspace package
```

Then pick your playground:

```bash
pnpm playground:web      # web app — compiles videos in-browser (no server), premium pack included
pnpm playground:start    # Expo mobile app (start the server too: pnpm server:dev)
pnpm compile packages/creative-kit/src/templates/quote.json   # CLI → a premium card
```

Or drive it like an AI agent would — discover, validate, and render a premium template headless, with no API key (see [`examples/agent-demo`](examples/agent-demo)):

```bash
pnpm --filter ffmpeg-video-composer build && pnpm --filter @leclap/mcp build
node examples/agent-demo/run.mjs    # MCP loop → a deterministic premium mp4
```

<br clear="right" />

> New to mise? See the [mise install guide](https://mise.jdx.dev/getting-started.html). Once activated in your shell, the pinned tools (Node, pnpm, FFmpeg) are placed on your `PATH` automatically when you `cd` into the repo; otherwise prefix commands with `mise exec --` (e.g. `mise exec -- pnpm test`). Prefer to manage versions yourself? Bring **Node ≥ 24, pnpm 11, and a `drawtext`-capable FFmpeg** — but mise keeps everyone aligned, and `engine-strict` rejects unsupported Node versions.

## 📦 Monorepo structure

pnpm workspaces (`apps/*`, `packages/*`) — no turbo/nx. The repo root is a private orchestrator (`leclap`); only `ffmpeg-video-composer` is published to npm.

| Package                 | Path                             | Description                                                                        |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `leclap` _(private)_    | `.`                              | Workspace root — shared dev tooling (`vp`, vitest) and orchestration scripts only. |
| `ffmpeg-video-composer` | `packages/ffmpeg-video-composer` | **The library** — cross-platform composition engine + CLI (Node, browser, WASM).   |
| `@leclap/server-app`    | `packages/server-app`            | Fastify HTTP server exposing `/compile`, `/templates`, `/health` _(demo)_.         |
| `@leclap/mcp`           | `packages/mcp`                   | MCP server — the engine as agent-callable tools (compose/list/probe) over stdio.   |
| `@leclap/web`           | `apps/leclap-web`                | React 19 + Vite + Tailwind web app — in-browser FFmpeg via WASM _(reference)_.     |
| `@leclap/expo`          | `apps/leclap-expo`               | Expo / React Native app — on-device compiles via the native engine _(reference)_.  |
| `ffmpeg-engine`         | `packages/ffmpeg-engine`         | Rust engine embedding FFmpeg fftools for on-device compiles (Expo app).            |

The server, web, and mobile apps all run the same `ffmpeg-video-composer` core — the mobile app drives it on-device through the embedded native engine and falls back to the server.

## 🧩 Templates

A **template** drives the whole composition: a `global` block (defaults, theme colors, music, and the choices a builder exposes to end users) plus an ordered list of `sections`. Each section is a clip — video, image, color background, a form that collects user input, or a music picker — with its own FFmpeg `inputs → maps → filters` pipeline. Strings support `{{ variables }}`, `{{ colorN }}`, and `{{ form_field }}` placeholders resolved at compile time.

```jsonc
{
  "global": { "orientation": "landscape", "musicEnabled": true, "transitionDuration": 0.1 },
  "sections": [
    {
      "name": "clip_1",
      "type": "video",
      "options": { "videoUrl": "https://.../earth.mp4", "duration": 4 },
      "filters": [{ "type": "fadein", "values": { "color": "#000000" } }],
    },
  ],
}
```

📖 **Full reference:** [Template Configuration (JSON)](docs/template-configuration.md) · ready-made examples in [`packages/creative-kit/src/templates/`](packages/creative-kit/src/templates/).

✨ **Creative kit:** the shared template descriptors (intro, quote, titles, portrait reel, and more) look professional out of the box — they use only the filters and bundled fonts the engine ships, so they render identically on Node, in the browser (WASM), and on-device. Start from one, then tweak text, colors, and media — by prompt (MCP) or in the visual builder.

## 📥 Using the library

Install `ffmpeg-video-composer` in your own project — it auto-detects the best FFmpeg implementation available:

```bash
pnpm install ffmpeg-video-composer                       # system FFmpeg
pnpm install ffmpeg-video-composer ffmpeg-static         # bundled binary fallback
pnpm install ffmpeg-video-composer @ffmpeg/ffmpeg @ffmpeg/util   # browser (WASM)
```

```javascript
import { compile, loadConfig } from 'ffmpeg-video-composer';

const projectConfig = {
  buildDir: './build',
  assetsDir: './assets',
  currentLocale: 'en',
  fields: { form_1_firstname: 'Firstname', form_1_lastname: 'Lastname' },
};

const template = await loadConfig('./my-template.json');
const result = await compile(projectConfig, template);
```

### FFmpeg detection order

The library picks the best available implementation automatically:

1. 🖥️ **System FFmpeg** — your installed binary (fastest, recommended for production).
2. 📦 **Static FFmpeg** — bundled binary via `ffmpeg-static` (zero-config fallback).
3. 🌐 **WebAssembly** — `@ffmpeg/ffmpeg` in the browser (2 GB input limit).
4. ❌ **None** — a clear message with installation guidance.

Supported environments: **Node.js**, **browsers** (WASM), **React Native** (needs `ffmpeg-kit-react-native`), and **Electron** (both implementations). See [FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md) for details.

> ⚠️ **`drawtext` filter required.** Text/intertitle/background-color segments need an FFmpeg built with `libfreetype`. `mise install` provides one; Homebrew's split `ffmpeg` does not (use `brew install ffmpeg-full`). Verify with `ffmpeg -hide_banner -filters | grep drawtext`.

## 🛠️ Development

Tooling is **vite-plus (`vp`)**.

| Task           | Command                                                           |
| -------------- | ----------------------------------------------------------------- |
| Build all      | `pnpm build`                                                      |
| Test           | `pnpm test` · UI: `pnpm test:ui` · coverage: `pnpm test:coverage` |
| Lint / format  | `pnpm lint` · `pnpm fmt` (check: `pnpm fmt:check`)                |
| All checks     | `pnpm check`                                                      |
| Web app        | `pnpm playground:web`                                             |
| Mobile app     | `pnpm playground:start` (also `:ios` / `:android`)                |
| Server         | `pnpm server:dev`                                                 |
| Diagnose setup | `pnpm diagnose`                                                   |

> Tests render real video segments, so a `drawtext`-capable FFmpeg must be on your `PATH` (`mise install` first). Run `mise exec -- pnpm test` if mise isn't activated in your shell.

## 📱 Apps

- **Web** ([`@leclap/web`](apps/leclap-web)) — React 19 + Vite + Tailwind; runs FFmpeg **entirely in the browser** via WebAssembly, no server required (2 GB input limit). Start with `pnpm playground:web`.
- **Mobile** ([`@leclap/expo`](apps/leclap-expo)) — Expo / React Native client. Start the server first (`pnpm server:dev`), then `pnpm playground:start` (or `:ios` / `:android`).

## 📚 Documentation

- **[🧩 Template Configuration](docs/template-configuration.md)** — the template JSON reference: global config, sections, the FFmpeg pipeline, and placeholders.
- **[🏗 Architecture](docs/architecture.md)** — system architecture and design patterns.
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** — how automatic FFmpeg detection works.
- **[📱 On-Device Compilation](docs/on-device-compilation.md)** — the serverless Expo compile pipeline: hybrid router → shared core → native FFmpeg engine.
- **[🤖 AGENTS.md](AGENTS.md)** — repo layout, commands, and conventions for contributors and AI agents.

## 🤝 Contributing & License

Issues and PRs welcome — open an issue on GitHub for questions or feedback. Keep changes formatted (`pnpm fmt`) and lint-clean (`pnpm lint`) before committing.

Licensed under the [MIT License](LICENSE).
