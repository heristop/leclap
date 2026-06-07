# AGENTS.md

Guidance for AI agents working in the **ffmpeg-video-composer** monorepo. This is the canonical, tool-agnostic agent guide. Read it first.

## Project overview

A template-based, cross-platform FFmpeg video composer. A JSON template describes a video's structure (sections, filters, music); the engine compiles it into a finished video. The same core runs on **Node.js**, in the **browser** (WebAssembly), and in **React Native**.

- High-level intro: [`README.md`](./README.md)
- Architecture & design patterns: [`docs/architecture.md`](./docs/architecture.md)
- Template JSON reference: [`docs/template-schema.md`](./docs/template-schema.md)
- FFmpeg detection/fallback: [`docs/ffmpeg-fallback-strategy.md`](./docs/ffmpeg-fallback-strategy.md)

## Repository layout

pnpm workspaces (`apps/*`, `packages/*`); no turbo/nx.

| Path                | What it is                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | `@ffmpeg-video-composer/core` — cross-platform composition library (CLI + programmatic API). The heart of the repo. |
| `packages/server`   | Fastify HTTP server exposing `/compile`, `/templates`, `/health`. Consumes core.                                    |
| `apps/le-clap-expo` | Expo / React Native app — Tamagui UI, Zustand + AsyncStorage (offline-first), clean architecture.                   |
| `apps/le-clap-web`  | React 19 + Vite + Tailwind web app — runs FFmpeg fully in-browser via WASM.                                         |

## Setup

- **pnpm 11.5.2** (pinned via `packageManager`) and **Node ≥ 22.14.0** (`engine-strict=true` — wrong versions are rejected).
- Install: `pnpm install` at the repo root.
- FFmpeg is resolved at runtime — system → `ffmpeg-static` → `@ffmpeg/ffmpeg` (WASM). Installing system FFmpeg (e.g. via `mise`) is recommended for Node work. See `docs/ffmpeg-fallback-strategy.md`.

## Commands

Run from the repo root unless noted. Tooling is **vite-plus (`vp`)** — there is **no eslint, no prettier, and no jest at the root** (jest lives only inside `apps/le-clap-expo`).

| Task                | Command                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| Lint (oxlint)       | `pnpm lint`                                                            |
| Format              | `pnpm fmt` / check only: `pnpm fmt:check`                              |
| All checks          | `pnpm check`                                                           |
| Test (vitest)       | `pnpm test` · UI: `pnpm test:ui` · coverage: `pnpm test:coverage`      |
| Build (tsdown)      | `pnpm build`                                                           |
| Typecheck a package | `pnpm --filter <pkg> exec tsc --noEmit`                                |
| Run Expo app        | `pnpm playground:start` (also `playground:ios` / `playground:android`) |
| Run web app         | `pnpm playground:web`                                                  |
| Run server          | `pnpm server:dev`                                                      |

## Architecture & patterns

- **Platform abstraction** — `PlatformBridge` (`packages/core/src/platform/PlatformBridge.ts`) detects the runtime and wires the right adapters. Each capability has an `Abstract*` base and per-platform `*Adapter`s: FFmpeg, filesystem, logging, music, events.
- **Compilation flow** — `TemplateDirector` orchestrates: init → build sections → concat → apply music. Sections are created by `SegmentFactory` and rendered by `*Segment` classes; FFmpeg commands are assembled by the editor **managers** (asset/variable/map/filter/formatter).
- **Dependency injection** — tsyringe. Classes use `@injectable()` / `@singleton()`; dependencies are resolved from `container`. Wiring happens in the entry points `packages/core/src/index.ts` (Node) and `packages/core/src/browser.ts` (browser/WASM).
- **Validation** — templates are validated with zod schemas in `packages/core/src/schemas/template.schemas.ts` via `services/TemplateValidator.ts`.

## Conventions

- **Naming** — PascalCase for classes and their files (`VideoEditor.ts`); `Abstract*` for base classes; `*Adapter` for platform implementations. camelCase for non-class files (`default.config.ts`).
- **Format** (enforced by `vp`): semicolons, single quotes, `printWidth: 120`, `tabWidth: 2`, `trailingComma: es5`.
- **Path alias** — `@/*` → `packages/core/src/*`.
- **Decorators** — DI/decorators require `reflect-metadata` to be imported once at the entry point.
- Prefer reusing existing managers/adapters/factories over adding new abstractions; follow the patterns already in `packages/core`.

## Pre-commit

Git hooks run via vite-plus staged checks (`vp fmt` on `*.{ts,tsx,js,cjs,mjs,json,md,yml,yaml}`, `vp lint` on `*.{ts,tsx}`). Keep changes formatted (`pnpm fmt`) and lint-clean before committing.

## Skills

Repo-specific skills live in [`.agents/skills/`](./.agents/skills/). Load the matching one when its trigger applies:

- **authoring-video-templates** — creating/editing template JSON, sections, filters, maps, variables, or fixing validation errors.
- **core-architecture-patterns** — adding a segment type, platform adapter, or core service in `packages/core`.
- **monorepo-dev-workflow** — building, testing, linting, formatting, or running any app/package.
- **cross-platform-ffmpeg** — working across Node/Static/WASM FFmpeg, the PlatformBridge, or browser/RN constraints.

## Gotchas

- Browser/WASM compilation is limited to ~**2 GB** input (IndexedDB-backed filesystem).
- `engine-strict` will refuse installs on the wrong Node version.
- Forgetting `reflect-metadata` breaks all tsyringe DI at runtime.
- Don't reach for eslint/prettier/jest configs at the root — they don't exist; use `vp`.
