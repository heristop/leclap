---
name: monorepo-dev-workflow
description: Use when building, testing, linting, formatting, typechecking, or running any app or package in the ffmpeg-video-composer monorepo, or when looking for the right pnpm/vp command.
---

# Monorepo Dev Workflow

## Overview

pnpm workspaces (`apps/*`, `packages/*`), no turbo/nx. Tooling is **vite-plus (`vp`)** — it provides lint (oxlint), format, test (vitest), and staged checks. There is **no eslint, no prettier, and no jest at the root** (jest lives only inside `apps/le-clap-expo`).

- **pnpm 11.5.2**, **Node ≥ 22.14.0** (`engine-strict` — wrong versions are rejected). Install: `pnpm install`.

## Command map

| Task                | Command                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Lint                | `pnpm lint`                                                                         |
| Format / check      | `pnpm fmt` · `pnpm fmt:check`                                                       |
| All checks          | `pnpm check`                                                                        |
| Test                | `pnpm test` · UI `pnpm test:ui` · coverage `pnpm test:coverage` · CI `pnpm test:ci` |
| Build               | `pnpm build` (tsdown)                                                               |
| Typecheck a package | `pnpm --filter <pkg> exec tsc --noEmit`                                             |
| Run Expo app        | `pnpm playground:start` · `playground:ios` · `playground:android`                   |
| Run web app         | `pnpm playground:web`                                                               |
| Run server          | `pnpm server:dev`                                                                   |
| Build executables   | `pnpm build:exe:all`                                                                |
| Dep graph / check   | `pnpm graph` · `pnpm deps:check`                                                    |

`<pkg>` names: `@ffmpeg-video-composer/core`, `server`, `le-clap-expo`, `le-clap-web`.

## Before committing

1. `pnpm fmt` — format (semicolons, single quotes, width 120, 2-space, trailing comma es5).
2. `pnpm lint` — oxlint must be clean.
3. `pnpm test` for affected code; `tsc --noEmit` on the package you changed.

Git hooks run `vp` staged checks automatically (`fmt` on most files, `lint` on `*.{ts,tsx}`), but run them yourself first to avoid hook failures.

## Common mistakes

- Reaching for `eslint`/`prettier`/`jest` configs at the root — they don't exist; use `vp` / the table above.
- Running raw `tsc` without `--filter`/`-p` — typecheck per package.
- Ignoring `engine-strict` — install fails on the wrong Node version; switch Node (e.g. via `mise`/`nvm`) rather than forcing the install.
