<div align="center">

<img src="apps/leclap-web/public/pwa-512x512.png" alt="LeClap" width="104" height="104" />

# LeClap

**Deterministic, on-device, agent-callable video — composed by prompt or by hand.**

Describe a video in one JSON _template_ — sections, filters, music, overlays — then render the **same template identically** on a phone (React Native, **on-device**), in the **browser** (WebAssembly), or on a server. No upload, no server, no generative model: the output is deterministic and reproducible.

[![CI](https://github.com/heristop/ffmpeg-video-composer/actions/workflows/ci.yml/badge.svg)](https://github.com/heristop/ffmpeg-video-composer/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/en/)
[![pnpm](https://img.shields.io/badge/pnpm-11-f69220.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Quick start](#-quick-start) · [Templates](docs/template-configuration.md) · [Library API](packages/ffmpeg-video-composer/README.md) · [Architecture](docs/architecture.md) · [Docs](#-documentation)

</div>

---

## ✨ What is LeClap?

LeClap renders video from a single JSON _template_: the same spec — sections, filters, music, text overlays — runs on a server, in the browser via WebAssembly, and fully **on-device** on React Native, with no upload and no server required. Its uncontested corner is **deterministic + on-device + agent-callable** video, where generative tools (Sora/Runway) and backend-bound renderers (Remotion/Shotstack) can't reach: the full loop — record a clip from the camera, apply effects, mix music, add transitions, render — runs on the phone (or a browser tab), and an AI agent can author and render a template with no LLM in the output path.

|                                   |                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 🧩 **Template-driven**            | One JSON descriptor → a complete video. No imperative FFmpeg wrangling.                                                     |
| 🌍 **Runs everywhere**            | Node.js, browser (WASM), React Native, Electron — one codebase, identical output.                                           |
| 📹 **Capture → compose → render** | Record from the camera, trim/crop, mix music, add transitions, and render — captured, edited, and composed on-device.       |
| 🤖 **Agent-callable**             | An [MCP server](packages/mcp) lets an AI agent author & render a template — no LLM in the loop, just deterministic output.  |
| 🎨 **Premium out of the box**     | A bundled [creative kit](packages/creative-kit) of polished, on-device-safe templates — by prompt or in the visual builder. |
| 🧱 **Typed & validated**          | Zod-validated templates, strict TypeScript, dependency-injected architecture.                                               |

## 🎥 Demo

See it in action (unmute for sound):

https://github.com/heristop/assets/6bcd0578-7dee-4630-aa6b-c730cf5cec17

<img src="https://github.com/heristop/ffmpeg-video-composer/raw/main/docs/leclap.gif" alt="LeClap mobile app" width="240" align="right" />

## 🚀 Quick start

> 💡 **Recommended: [mise](https://mise.jdx.dev).** `mise install` provisions the exact pinned toolchain — **Node 24, pnpm 11, FFmpeg 8.1.1, and Rust** — so every contributor and CI run identical versions. Managing versions yourself? Bring **Node ≥ 24** and **pnpm 11**.

```bash
git clone https://github.com/heristop/ffmpeg-video-composer.git
cd ffmpeg-video-composer
mise install     # Node 24, pnpm 11, FFmpeg 8.1.1 + Rust
pnpm install
```

Then pick your playground:

```bash
pnpm playground:web      # web app — compiles videos in-browser (no server)
pnpm playground:start    # Expo mobile app (start the server too: pnpm server:dev)
pnpm compile packages/creative-kit/src/templates/quote.json   # CLI → a premium card
```

Or drive it like an AI agent would — discover, validate, and render a template headless, no API key ([`examples/agent-demo`](examples/agent-demo)):

```bash
pnpm --filter ffmpeg-video-composer build && pnpm --filter @leclap/mcp build
node examples/agent-demo/run.mjs    # MCP loop → a deterministic premium mp4
```

<br clear="right" />

## 📦 Monorepo

pnpm workspaces (`apps/*`, `packages/*`) — no turbo/nx. The root is a private orchestrator (`leclap`); only `ffmpeg-video-composer` is published to npm. The server, web, and mobile apps all run the same core — the mobile app drives it **on-device** via the embedded native engine, falling back to the server.

| Package                                                   | Description                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) | **The library** — cross-platform composition engine + CLI (Node, browser, WASM). |
| [`@leclap/creative-kit`](packages/creative-kit)           | Shared creative catalog — templates, partials, fonts, media, bundled assets.     |
| [`@leclap/mcp`](packages/mcp)                             | MCP server — the engine as agent-callable tools (compose/list/probe).            |
| [`@leclap/server-app`](packages/server-app)               | Fastify HTTP server exposing `/compile`, `/templates`, `/health` _(demo)_.       |
| [`@leclap/web`](apps/leclap-web)                          | React 19 + Vite + Tailwind — in-browser FFmpeg via WASM _(reference)_.           |
| [`@leclap/expo`](apps/leclap-expo)                        | Expo / React Native — on-device compiles via the native engine _(reference)_.    |
| [`ffmpeg-engine`](packages/ffmpeg-engine)                 | Rust engine embedding FFmpeg fftools for on-device compiles.                     |

## 🧩 Templates & library

A **template** is a Zod-validated JSON descriptor — a `global` block plus an ordered list of `sections`, each a clip with its own `inputs → maps → filters` pipeline and `{{ variable }}` placeholders. Start from a [creative-kit template](packages/creative-kit) and tweak text, colors, and media — by prompt (MCP) or in the visual builder.

- 📖 **[Template configuration reference](docs/template-configuration.md)** — global config, sections, the FFmpeg pipeline, placeholders.
- 📥 **[Use it as a library](packages/ffmpeg-video-composer/README.md)** — install, the `compile()` API, entry points (Node / browser / RN), and automatic FFmpeg detection.

## 📚 Documentation

- **[🧩 Template Configuration](docs/template-configuration.md)** — the template JSON reference.
- **[🏗 Architecture](docs/architecture.md)** — system architecture and design patterns.
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** — how automatic FFmpeg detection works.
- **[📱 On-Device Compilation](docs/on-device-compilation.md)** — the serverless Expo compile pipeline.
- **[🤖 AGENTS.md](AGENTS.md)** — repo layout, commands, and conventions for contributors and AI agents.

## 🤝 Contributing & License

Issues and PRs welcome. Keep changes formatted (`pnpm fmt`) and lint-clean (`pnpm lint`) before committing. Licensed under the [MIT License](LICENSE).
