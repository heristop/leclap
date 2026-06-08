<div align="center">

# 🎬 LeClap

**Template-driven video composition, powered by FFmpeg.**

Describe a video in JSON — sections, filters, music, overlays — and compile it on **Node.js**, in the **browser** (WebAssembly), or in **React Native**.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/en/)
[![pnpm](https://img.shields.io/badge/pnpm-11-f69220.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Demo](#-demo) · [Quick start](#-quick-start) · [Templates](docs/template-configuration.md) · [Library](#-using-the-library) · [Docs](#-documentation)

</div>

---

## ✨ What is LeClap?

LeClap is a **monorepo** for programmatic video creation. A JSON _template_ describes a video's structure — sections, filters, music, text overlays — and the engine renders it into a finished video with FFmpeg. The same engine runs server-side, fully client-side via WebAssembly, and on mobile.

At its core is the [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) library (published to npm, usable standalone). Around it sit an HTTP server and web + mobile apps that demonstrate it end to end.

|                            |                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------- |
| 🧩 **Template-driven**     | One JSON descriptor → a complete video. No imperative FFmpeg wrangling.             |
| 🌍 **Runs everywhere**     | Node.js, browser (WASM), React Native, Electron — one codebase.                     |
| 🔍 **Zero-config FFmpeg**  | Auto-detects system → static → WASM, with clear guidance when missing.              |
| 🎚️ **Composable pipeline** | Per-section `inputs → maps → filters` for real compositing, text, and audio mixing. |
| 🧱 **Typed & validated**   | Zod-validated templates, strict TypeScript, dependency-injected architecture.       |

## 🎥 Demo

See `ffmpeg-video-composer` in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

<img src="https://github.com/heristop/ffmpeg-video-composer/raw/main/docs/leclap.gif" alt="LeClap mobile app" width="280" align="right" />

## 🚀 Quick start

**Requirements:** [pnpm](https://pnpm.io/) 11, Node ≥ 24, and FFmpeg (with the `drawtext` filter). [mise](https://mise.jdx.dev) handles the toolchain for you.

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
mise install     # pinned Node 24 + a drawtext-capable FFmpeg
pnpm install     # wires up every workspace package
```

Then pick your playground:

```bash
pnpm playground:web      # web app — compiles videos in-browser (no server)
pnpm playground:start    # Expo mobile app (start the server too: pnpm server:dev)
pnpm compile packages/ffmpeg-video-composer/src/shared/templates/sample.json   # CLI → build/sample_output.mp4
```

<br clear="right" />

> Don't have mise? See [mise install](https://mise.jdx.dev/getting-started.html). Once activated, FFmpeg lands on your `PATH` automatically when you `cd` in; otherwise prefix commands with `mise exec --` (e.g. `mise exec -- pnpm test`). `engine-strict` rejects unsupported Node versions.

## 📦 Monorepo structure

pnpm workspaces (`apps/*`, `packages/*`) — no turbo/nx. The repo root is a private orchestrator (`le-clap`); only `ffmpeg-video-composer` is published to npm.

| Package                 | Path                             | Description                                                                        |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `le-clap` _(private)_   | `.`                              | Workspace root — shared dev tooling (`vp`, vitest) and orchestration scripts only. |
| `ffmpeg-video-composer` | `packages/ffmpeg-video-composer` | **The library** — cross-platform composition engine + CLI (Node, browser, WASM).   |
| `@le-clap/server`       | `packages/server`                | Fastify HTTP server exposing `/compile`, `/templates`, `/health`.                  |
| `@le-clap/web`          | `apps/le-clap-web`               | React 19 + Vite + Tailwind web app — runs FFmpeg entirely in-browser via WASM.     |
| `@le-clap/expo`         | `apps/le-clap-expo`              | Expo / React Native app — Tamagui UI, offline-first (Zustand + AsyncStorage).      |

The server and web app depend on `ffmpeg-video-composer`; the mobile app talks to the server.

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

📖 **Full reference:** [Template Configuration (JSON)](docs/template-configuration.md) · ready-made examples in [`src/shared/templates/`](packages/ffmpeg-video-composer/src/shared/templates/).

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

Tooling is **vite-plus (`vp`)** — no eslint, prettier, or root jest (jest lives only inside the Expo app).

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

- **Web** ([`@le-clap/web`](apps/le-clap-web)) — React 19 + Vite + Tailwind; runs FFmpeg **entirely in the browser** via WebAssembly, no server required (2 GB input limit). Start with `pnpm playground:web`.
- **Mobile** ([`@le-clap/expo`](apps/le-clap-expo)) — Expo / React Native client. Start the server first (`pnpm server:dev`), then `pnpm playground:start` (or `:ios` / `:android`).

## 📚 Documentation

- **[🧩 Template Configuration](docs/template-configuration.md)** — the template JSON reference: global config, sections, the FFmpeg pipeline, and placeholders.
- **[🏗 Architecture](docs/architecture.md)** — system architecture and design patterns.
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** — how automatic FFmpeg detection works.
- **[🤖 AGENTS.md](AGENTS.md)** — repo layout, commands, and conventions for contributors and AI agents.

## 🤝 Contributing & License

Issues and PRs welcome — open an issue on GitHub for questions or feedback. Keep changes formatted (`pnpm fmt`) and lint-clean (`pnpm lint`) before committing.

Licensed under the [MIT License](LICENSE).
