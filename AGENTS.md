# AGENTS.md

Guidance for AI agents working in the **leclap** monorepo. This is the canonical, tool-agnostic agent guide. Read it first.

## Project overview

A template-based, cross-platform FFmpeg video composer. A JSON template describes a video's structure (sections, filters, music); the engine compiles it into a finished video. The same core runs on **Node.js**, in the **browser** (WebAssembly), and in **React Native**.

- High-level intro: [`README.md`](./README.md)
- Architecture & design patterns: [`docs/architecture.md`](./docs/architecture.md)
- Template JSON reference: [`docs/template-configuration.md`](./docs/template-configuration.md)
- FFmpeg detection/fallback: [`docs/ffmpeg-fallback-strategy.md`](./docs/ffmpeg-fallback-strategy.md)

## Repository layout

pnpm workspaces (`apps/*`, `packages/*`); no turbo/nx. The repo root is a **private orchestrator** (`leclap`) holding only shared dev tooling and scripts — not a publishable package. The single published artifact is `ffmpeg-video-composer`; everything else is scoped `@leclap/*`.

| Path                             | Package                 | What it is                                                                                          |
| -------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `.`                              | `leclap` _(private)_    | Workspace root — shared tooling (`vp`, vitest) and orchestration scripts only.                      |
| `packages/ffmpeg-video-composer` | `ffmpeg-video-composer` | The composition library (CLI + programmatic API), Node + browser/WASM. The heart of the repo.       |
| `packages/server-app`            | `@leclap/server-app`    | Fastify HTTP server exposing `/compile`, `/templates`, `/health`. Consumes `ffmpeg-video-composer`. |
| `packages/ffmpeg-engine`         | _(cargo crate)_         | Embedded FFmpeg engine (Rust + uniffi) for on-device compiles; built via `scripts/ffmpeg/`.         |
| `apps/leclap-expo`               | `@leclap/expo`          | Expo / React Native app — Tamagui UI, Zustand + AsyncStorage (offline-first), clean architecture.   |
| `apps/leclap-web`                | `@leclap/web`           | React 19 + Vite + Tailwind web app — runs FFmpeg fully in-browser via WASM.                         |

The `compile`/`diagnose` dev scripts live in `packages/ffmpeg-video-composer` (root `pnpm compile` / `pnpm diagnose` delegate to them).

## Setup

- **pnpm 11.5.2** (pinned via `packageManager`) and **Node ≥ 24** (pinned to 24 via `mise.toml`; `engine-strict=true` rejects wrong versions).
- Install: `pnpm install` at the repo root.
- FFmpeg is resolved at runtime — system → `ffmpeg-static` → `@ffmpeg/ffmpeg` (WASM). Installing system FFmpeg (e.g. via `mise`) is recommended for Node work. See `docs/ffmpeg-fallback-strategy.md`.

## Commands

Run from the repo root unless noted. Tooling is **vite-plus (`vp`)** — there is **no eslint, no prettier, and no jest at the root** (jest lives only inside `apps/leclap-expo`).

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

- **Platform abstraction** — `PlatformBridge` (`packages/ffmpeg-video-composer/src/platform/PlatformBridge.ts`) detects the runtime and wires the right adapters. Each capability has an `Abstract*` base and per-platform `*Adapter`s: FFmpeg, filesystem, logging, music, events.
- **Compilation flow** — `TemplateDirector` orchestrates: init → build sections → concat → apply music. Sections are created by `SegmentFactory` and rendered by `*Segment` classes; FFmpeg commands are assembled by the editor **managers** (asset/variable/map/filter/formatter).
- **On-device compilation (Expo)** — the app drives the same core through a native FFmpeg CLI engine (`packages/ffmpeg-engine` + `FFmpegLeclapAdapter`) instead of WASM/system FFmpeg; `compileHybrid` falls back to the server when the engine is absent or can't render a job. See [`docs/on-device-compilation.md`](./docs/on-device-compilation.md).
- **Dependency injection** — tsyringe. Classes use `@injectable()` / `@singleton()`; dependencies are resolved from `container`. Wiring happens in the entry points `packages/ffmpeg-video-composer/src/index.ts` (Node) and `packages/ffmpeg-video-composer/src/browser.ts` (browser/WASM).
- **Validation** — templates are validated with zod schemas in `packages/ffmpeg-video-composer/src/schemas/template.schemas.ts` via `services/TemplateValidator.ts`.

## Conventions

- **Naming** — PascalCase for classes and their files (`VideoEditor.ts`); `Abstract*` for base classes; `*Adapter` for platform implementations. camelCase for non-class files (`default.config.ts`).
- **Format** (enforced by `vp`): semicolons, single quotes, `printWidth: 120`, `tabWidth: 2`, `trailingComma: es5`.
- **Path alias** — `@/*` → `packages/ffmpeg-video-composer/src/*`.
- **Decorators** — DI/decorators require `reflect-metadata` to be imported once at the entry point.
- **React Compiler is enabled** in both apps (`apps/leclap-web` via `@vitejs/plugin-react`'s Babel pass; `apps/leclap-expo` via `app.json` → `experiments.reactCompiler`). Don't add `useMemo`/`useCallback`/`React.memo` — the compiler memoizes automatically.
- **Tests** — core's unit + integration suite lives in `packages/ffmpeg-video-composer/tests/` (run by the root `pnpm test` / vitest); the Expo app keeps its own jest tests under `apps/leclap-expo`.
- Prefer reusing existing managers/adapters/factories over adding new abstractions; follow the patterns already in `packages/ffmpeg-video-composer`.

### Design system & styling (web — `apps/leclap-web`)

- **The design system is shadcn/ui + Radix** — utility-first, not BEM. Primitives live in `src/presentation/components/ui/` as shadcn-style components: Radix primitives for behavior/accessibility, styled with Tailwind utility classes, variants via **`class-variance-authority` (cva)**, classes merged with **`cn()`** (`@/lib/utils`, clsx + tailwind-merge). Add components via the shadcn CLI/registry; config in `components.json`.
- **Brand integration:** shadcn's CSS-variable contract (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--border`, `--ring`, `--card`, …) is mapped onto the OKLCH brand tokens in `@theme` / `.dark` (`src/index.css`) so every shadcn primitive renders on-brand (lavender `--primary`, etc.). Never hard-code colors — reference tokens.
- **Tokens & theme:** OKLCH CSS variables in `@theme` (`src/index.css`); light is the default, `.dark` on `<html>` swaps semantic surface/text tokens; brand/secondary/accent ramps are theme-constant.
- **Dependencies:** Radix is added per primitive (`@radix-ui/react-*`) plus `class-variance-authority`; pin versions old enough to satisfy the `minimumReleaseAge` supply-chain policy (`pnpm-workspace.yaml`).
- **Path alias** in the web app: `@/*` → `apps/leclap-web/src/*` (distinct from core's `@/*`).

## Pre-commit

Git hooks run via vite-plus staged checks (`vp fmt` on `*.{ts,tsx,js,cjs,mjs,json,md,yml,yaml}`, `vp lint` on `*.{ts,tsx}`). Keep changes formatted (`pnpm fmt`) and lint-clean before committing.

## Skills

Repo-specific skills live in [`.agents/skills/`](./.agents/skills/). Load the matching one when its trigger applies:

- **authoring-video-templates** — creating/editing template JSON, sections, filters, maps, variables, or fixing validation errors.
- **core-architecture-patterns** — adding a segment type, platform adapter, or core service in `packages/ffmpeg-video-composer`.
- **monorepo-dev-workflow** — building, testing, linting, formatting, or running any app/package.
- **cross-platform-ffmpeg** — working across Node/Static/WASM FFmpeg, the PlatformBridge, or browser/RN constraints.

## Gotchas

- Browser/WASM compilation is limited to ~**2 GB** input (IndexedDB-backed filesystem).
- `engine-strict` will refuse installs on the wrong Node version.
- Forgetting `reflect-metadata` breaks all tsyringe DI at runtime.
- Don't reach for eslint/prettier/jest configs at the root — they don't exist; use `vp`.
