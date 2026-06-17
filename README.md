<div align="center">

<img src="apps/leclap-web/public/pwa-512x512.png" alt="LeClap" width="104" height="104" />

# LeClap

**Deterministic, on-device, agent-callable video — composed by prompt or by hand.**

Describe a video in one JSON _template_ — sections, filters, music, overlays — then render the **same template identically** on a phone (React Native, **on-device**) or in the **browser** (WebAssembly). No upload, no server, no generative model: the output is deterministic and reproducible.

[![CI](https://github.com/heristop/leclap/actions/workflows/ci.yml/badge.svg)](https://github.com/heristop/leclap/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/en/)
[![pnpm](https://img.shields.io/badge/pnpm-11-f69220.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Quick start](#-quick-start) · [Templates](docs/template-configuration.md) · [Library API](packages/ffmpeg-video-composer/README.md) · [Architecture](docs/architecture.md) · [Docs](#-documentation)

</div>

---

## ✨ What is LeClap?

LeClap renders video from a single JSON _template_: the same spec — sections, filters, music, text overlays — runs in the browser via WebAssembly and fully **on-device** on React Native, with no upload and no server required. Its uncontested corner is **deterministic + on-device + agent-callable** video, where generative tools (Sora/Runway) and backend-bound renderers (Remotion/Shotstack) can't reach: the full loop — record a clip from the camera, apply effects, mix music, add transitions, render — runs on the phone (or a browser tab), and an AI agent can author and render a template with no LLM in the output path.

| Highlight                         | What it means                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 🧩 **Template-driven**            | One JSON descriptor → a complete video. No imperative FFmpeg wrangling.                                                            |
| 🌍 **Runs everywhere**            | Node.js, browser (WASM), and React Native — one shared core, deterministic output.                                                 |
| 📹 **Capture → compose → render** | Record from the camera, trim/crop, mix music, add transitions, and render — captured, edited, and composed on-device.              |
| 🤖 **Agent-callable**             | An [MCP server](packages/leclap-mcp) lets an AI agent author & render a template — no LLM in the loop, just deterministic output.  |
| 🎨 **Premium out of the box**     | A bundled [creative kit](packages/leclap-creative-kit) of polished, on-device-safe templates — by prompt or in the visual builder. |
| 🧱 **Typed & validated**          | Zod-validated templates, strict TypeScript, dependency-injected architecture.                                                      |

## 🎥 Demo

See it in action (unmute for sound):

https://github.com/user-attachments/assets/7edb7990-0dba-43d8-b69b-b357e05e18ba

<p align="center"><img src="https://github.com/heristop/leclap/raw/main/docs/leclap.gif" alt="LeClap mobile app" width="260" /></p>

## 🚀 Quick start

> 💡 **Recommended: [mise](https://mise.jdx.dev).** `mise install` provisions the exact pinned toolchain — **Node 24, pnpm 11, FFmpeg 8.1.1, and Rust** — so every contributor and CI run identical versions. Managing versions yourself? Bring **Node ≥ 24** and **pnpm 11**.

```bash
git clone https://github.com/heristop/leclap.git
cd ffmpeg-video-composer
mise install     # Node 24, pnpm 11, FFmpeg 8.1.1 + Rust
pnpm install
```

Then pick an app:

```bash
pnpm app:web      # web app — compiles videos in-browser (no server)
pnpm app:expo     # Expo mobile app — compiles fully on-device (no server)
```

Or use the CLI — [`@leclap/cli`](packages/leclap-cli) is the `leclap` dev tool:

```bash
npx @leclap/cli init my-video         # scaffold a starter project
npx @leclap/cli render template.json  # render it (`leclap diagnose` checks your FFmpeg)
```

Or drive it from an AI agent: the [`@leclap/mcp`](packages/leclap-mcp) server exposes the engine as MCP tools — discover → validate → render — with no LLM in the output path.

## 📦 Monorepo

pnpm workspaces (`apps/*`, `packages/*`) — no turbo/nx. The root is a private orchestrator (`leclap`); `ffmpeg-video-composer`, `@leclap/cli`, and `@leclap/mcp` are published to npm. The web and mobile apps both run the same core — the mobile app drives it **fully on-device** via the embedded native engine (no server), the web app in-browser via WASM.

| Package                                                   | Description                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`ffmpeg-video-composer`](packages/ffmpeg-video-composer) | **The library** — cross-platform composition engine (Node, browser, WASM).    |
| [`@leclap/cli`](packages/leclap-cli)                      | **The CLI** — the `leclap` dev tool: scaffold (`init`), `render`, `diagnose`. |
| [`@leclap/creative-kit`](packages/leclap-creative-kit)    | Shared creative catalog — templates, partials, fonts, media, bundled assets.  |
| [`@leclap/mcp`](packages/leclap-mcp)                      | MCP server — the engine as agent-callable tools (compose/list/probe).         |
| [`@leclap/web`](apps/leclap-web)                          | React 19 + Vite + Tailwind — in-browser FFmpeg via WASM _(reference)_.        |
| [`@leclap/expo`](apps/leclap-expo)                        | Expo / React Native — on-device compiles via the native engine _(reference)_. |
| [`ffmpeg-engine`](packages/ffmpeg-engine)                 | Rust engine embedding FFmpeg fftools for on-device compiles.                  |

## 🧩 Templates & library

A **template** is a Zod-validated JSON descriptor — a `global` block plus an ordered list of `sections`, each a clip with its own `inputs → maps → filters` pipeline and `{{ variable }}` placeholders. Start from a [creative-kit template](packages/leclap-creative-kit) and tweak text, colors, and media — by prompt (MCP) or in the visual builder.

- 📖 **[Template configuration reference](docs/template-configuration.md)** — global config, sections, the FFmpeg pipeline, placeholders.
- 📥 **[Use it as a library](packages/ffmpeg-video-composer/README.md)** — install, the `compile()` API, entry points (Node / browser / RN), and automatic FFmpeg detection.

## 📚 Documentation

- **[🌐 Descriptor reference (web)](https://leclap.dev/doc)** — the full, schema-driven descriptor reference, one page per topic (sections, transitions, looks, grade, motion, audio, captions, filters, examples, JSON Schema).
- **[🧩 Template Configuration](docs/template-configuration.md)** — the template JSON reference.
- **[🏗 Architecture](docs/architecture.md)** — system architecture and design patterns.
- **[🔧 FFmpeg Fallback Strategy](docs/ffmpeg-fallback-strategy.md)** — how automatic FFmpeg detection works.
- **[📱 On-Device Compilation](docs/on-device-compilation.md)** — the serverless Expo compile pipeline.
- **[🤖 AGENTS.md](AGENTS.md)** — repo layout, commands, and conventions for contributors and AI agents.

## 🤝 Contributing & License

Issues and PRs welcome. Keep changes formatted (`pnpm fmt`) and lint-clean (`pnpm lint`) before committing. Licensed under the [MIT License](LICENSE).
