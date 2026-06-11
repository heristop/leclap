# Contributing

Thanks for your interest in improving **ffmpeg-video-composer** (the `leclap` monorepo). This guide covers local setup, the day-to-day workflow, and how to get a change merged.

## Prerequisites

The toolchain is pinned via [`mise`](https://mise.jdx.dev/) (Node 24, pnpm 11, Rust stable, and a full FFmpeg build). With `mise` installed:

```bash
mise install     # installs Node, pnpm, Rust, FFmpeg at the pinned versions
pnpm install     # installs workspace dependencies
```

`engine-strict` rejects the wrong Node version, so use the pinned toolchain rather than a system install.

## Repository layout

This is a pnpm-workspace monorepo (`apps/*`, `packages/*`). The full layout, architecture, and conventions live in **[AGENTS.md](./AGENTS.md)** — read it first; it is the single source of truth.

In short:

- `packages/ffmpeg-video-composer` — the published composition library (Node + browser/WASM).
- `packages/server-app` — Fastify demo server (`/compile`, `/templates`, `/health`).
- `packages/ffmpeg-engine` — Rust + uniffi on-device FFmpeg engine.
- `apps/leclap-web` — React + Vite web app (in-browser WASM).
- `apps/leclap-expo` — Expo / React Native app.

## Common commands

Run from the repo root unless noted. Tooling is **vite-plus (`vp`)** plus **oxlint** — there is no eslint, prettier, or root-level jest.

| Task            | Command                                   |
| --------------- | ----------------------------------------- |
| Lint (oxlint)   | `pnpm lint`                               |
| Format          | `pnpm fmt` (check only: `pnpm fmt:check`) |
| All checks      | `pnpm check`                              |
| Test (vitest)   | `pnpm test`                               |
| Build (tsdown)  | `pnpm build`                              |
| Typecheck a pkg | `pnpm --filter <pkg> exec tsc --noEmit`   |

Please make sure `pnpm test`, `pnpm lint`, and `pnpm build` pass before opening a PR.

## Building the on-device engine

The native FFmpeg engine binaries are **not committed**; build them from source:

```bash
scripts/ffmpeg/build-engine.sh
```

Build-environment notes live in [`docs/on-device-compilation.md`](./docs/on-device-compilation.md). You only need this when working on `apps/leclap-expo`'s on-device compile path.

## Commit convention

Commits follow **Conventional Commits** with a **lowercase**, single-line subject:

```
fix(expo): real bundle id and env-driven api url
feat(core): add intertitle segment
docs: add contributing guide
```

Use scopes that match the package/app (`core`, `expo`, `web`, `server`). Keep each commit focused and path-limited.

## Pull requests

1. Branch off `main`.
2. Make focused commits following the convention above.
3. Run `pnpm test`, `pnpm lint`, and `pnpm build`; format with `pnpm fmt`.
4. Open a PR using the [pull request template](./.github/pull_request_template.md), describing the change, the testing done, and any docs updated.

Pre-commit hooks (vite-plus staged checks) run `vp fmt` and `vp lint` on staged files automatically.
