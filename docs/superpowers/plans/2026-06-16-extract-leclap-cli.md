# Extract the CLI into `@leclap/cli` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **On start, copy this plan to `docs/superpowers/plans/2026-06-16-extract-leclap-cli.md`** (plan was authored in plan mode where only the scratch plan file was writable).

## Context

`ffmpeg-video-composer` (the engine/library, `packages/ffmpeg-video-composer`, v2.0.0-beta.0) currently also ships the **CLI**: a `bin` named `leclap`, a `src/cli.ts` entry (tsdown-built to `dist/cli.js`), a `bin/leclap.js` wrapper, a `src/cli/resolveAssetsDir.ts` helper, and a separate hand-maintained `src/cli/executable.js` used by `build:exe` (@yao-pkg/pkg standalone binaries). Mixing the CLI into the library bloats its install (CLI-only deps), muddies its scope, and ties the `leclap` brand to the unscoped engine package.

**Goal:** split the CLI into its own brand package **`@leclap/cli`** (dir `packages/leclap-cli`, bin `leclap`) that depends on `ffmpeg-video-composer` via the workspace protocol and uses only its **public API**. `ffmpeg-video-composer` keeps its name, version, scope, and all library exports — it just stops shipping a CLI. Decisions (locked with user): name **`@leclap/cli`** / bin **`leclap`**; **move** `build:exe` to the CLI package; **clean removal** of the old bin from the library (no shim — it's a 2.0 beta).

**Tech stack:** pnpm workspace, tsdown (ESM, node), tsc, vitest (`vp` = vite-plus), @yao-pkg/pkg. The CLI imports only `ffmpeg-video-composer`'s public exports — verified: `cli.ts` uses `{ compile, loadConfig, FFmpegDetector, Terminal }` + types `{ ProjectConfig, TemplateDescriptor }`, all exported from the package root (same as `@leclap/mcp` consumes).

## Architecture & reuse

Scaffold `@leclap/cli` by mirroring **`@leclap/mcp`** (`packages/leclap-mcp`) — the closest published Node package with a `bin` that depends on the core:

- `package.json` shape (workspace dep, `bin`, `files`, `prepack`, `engines`), `tsconfig.json` (path alias `ffmpeg-video-composer` → `../ffmpeg-video-composer/dist`), `tsdown.config.ts` (ESM, node, shebang banner, `ffmpeg-video-composer` external), `vitest.config.ts` (swc + node).
- Inter-package imports resolve from the core's **built `dist`** (path alias + `workspace:*`), exactly like `@leclap/mcp`.

The CLI logic moves **unchanged** except its import source: `from './index'` → `from 'ffmpeg-video-composer'`. `resolveAssetsDir`'s `../../leclap-creative-kit/src/library` fallback still resolves correctly from `packages/leclap-cli/dist` (both are siblings under `packages/`).

**DRY the standalone binary:** drop the duplicated `executable.js`; point `build:exe` at the tsdown-built `dist/index.js` (the same compiled CLI). One source of truth.

---

## File map

**Create — `packages/leclap-cli/`:**

- `package.json` — `@leclap/cli`, `bin { leclap: ./dist/index.js }`, `files: ["dist","README.md"]`, deps `ffmpeg-video-composer: workspace:*` + `picocolors` + `reflect-metadata`; devDeps mirror `@leclap/mcp` + `@yao-pkg/pkg`; scripts `build`/`prepack` (tsdown), `typecheck`, `test`, `build:exe`, `build:exe:all`; `engines.node >=24.11.0`.
- `tsconfig.json` — copy `@leclap/mcp`'s (path alias to `../ffmpeg-video-composer/dist`).
- `tsdown.config.ts` — single entry `src/index.ts` → `dist/index.js`, ESM, node, `banner: '#!/usr/bin/env node'`, `neverBundle: ['ffmpeg-video-composer','picocolors','reflect-metadata', node builtins…]`.
- `vitest.config.ts` — copy `@leclap/mcp`'s.
- `src/index.ts` — moved from `ffmpeg-video-composer/src/cli.ts`, with imports changed to `from 'ffmpeg-video-composer'` (public API + types) and `from './resolveAssetsDir'`.
- `src/resolveAssetsDir.ts` — moved from `ffmpeg-video-composer/src/cli/resolveAssetsDir.ts`, refactored for testability (inject `exists`). _TDD._
- `src/resolveAssetsDir.test.ts` — unit tests. _TDD._
- `README.md` — CLI usage (`npx @leclap/cli <template>`, `--diagnose`, `--help`, `--version`, standalone binaries).

**Modify — `packages/ffmpeg-video-composer/`:**

- `package.json` — remove `bin`; drop `build:exe`/`build:exe:all` scripts; remove `@yao-pkg/pkg` devDep; set `files: ["dist","README.md","MIGRATION.md"]` (drop `bin`).
- `tsdown.config.ts` — remove the **CLI entry** (the `src/cli.ts` config block); keep the node/browser/reactnative entries and the font/music `copy`.
- **Delete** `src/cli.ts`, `src/cli/resolveAssetsDir.ts`, `src/cli/executable.js`, `bin/leclap.js` (and the now-empty `src/cli/`, `bin/`).
- `README.md` — repoint the CLI/quick-start section to `@leclap/cli` (`npx @leclap/cli my-template.json`, `npx @leclap/cli --diagnose`); keep the library `import { compile, loadConfig }` examples.

**Modify — root + docs:**

- root `package.json` — `build:exe`/`build:exe:all` → `--filter @leclap/cli …`. (`compile`/`diagnose` dev scripts stay — they target the library's `compile.ts`/`diagnose.ts`, which are unchanged.)
- `MIGRATION.md` — update CLI rows: the `leclap` bin now lives in `@leclap/cli`; `ffmpeg-video-composer --diagnose` → `@leclap/cli --diagnose`.
- `apps/leclap-web/src/presentation/pages/Doc.tsx` — `CommandPill` command `npx ffmpeg-video-composer my-template.json` → `npx @leclap/cli my-template.json`.

---

## Tasks

### Task 1: Scaffold `@leclap/cli` (manifest + build config)

- [ ] Create `packages/leclap-cli/{package.json,tsconfig.json,tsdown.config.ts,vitest.config.ts}` by copying `@leclap/mcp`'s and adapting: name `@leclap/cli`, `bin { leclap: ./dist/index.js }`, deps as above, single tsdown entry `src/index.ts`. Add `build:exe` = `pkg dist/index.js --targets node24-win-x64,node24-macos-x64,node24-linux-x64 --out-path dist/bin` and `build:exe:all` = `pnpm build && pnpm build:exe`.
- [ ] `pnpm install` to link the workspace.
- [ ] Commit (ask first): `chore(cli): scaffold @leclap/cli package`.

### Task 2: `resolveAssetsDir` — move + make testable (TDD)

- **Files:** create `packages/leclap-cli/src/resolveAssetsDir.ts` + `.test.ts`.
- [ ] Failing tests: with an injected `exists` predicate — returns `<cwd>/assets` when it exists; returns the bundled `…/leclap-creative-kit/src/library` demo path when `<cwd>/assets` is absent but the demo exists; falls back to `<cwd>/assets` when neither exists.
- [ ] Implement: lift the body from the library's `resolveAssetsDir.ts`, add an optional last param `exists: (p: string) => boolean = existsSync` so the fs check is injectable (no behavior change for callers). Keep the `console.log` demo notice.
- [ ] `pnpm --filter @leclap/cli exec vitest run` → green. Commit (ask first): `feat(cli): asset-dir resolution`.

### Task 3: Move the CLI entry

- **Files:** create `packages/leclap-cli/src/index.ts` (from `ffmpeg-video-composer/src/cli.ts`), `packages/leclap-cli/README.md`.
- [ ] Copy `cli.ts` → `src/index.ts`; change imports: `import { compile, loadConfig, FFmpegDetector, Terminal, type ProjectConfig, type TemplateDescriptor } from 'ffmpeg-video-composer'` and `import { resolveAssetsDir } from './resolveAssetsDir'`. The `showVersion` `../package.json` resolve still works (now reads `@leclap/cli`'s manifest — fine).
- [ ] Write the CLI README.
- [ ] `pnpm --filter @leclap/cli build` → emits `dist/index.js` with shebang; `node dist/index.js --help` / `--version` / `--diagnose` work. Commit (ask first): `feat(cli): leclap CLI entry from the library`.

### Task 4: Strip the CLI from `ffmpeg-video-composer`

- **Files:** modify `packages/ffmpeg-video-composer/{package.json,tsdown.config.ts,README.md}`; delete `src/cli.ts`, `src/cli/`, `bin/`.
- [ ] Remove the `bin`, the `build:exe`/`build:exe:all` scripts, the `@yao-pkg/pkg` devDep, and `bin` from `files`. Remove the CLI entry block from `tsdown.config.ts`. Delete the CLI source files + `bin/leclap.js`.
- [ ] `pnpm --filter ffmpeg-video-composer build` → no `dist/cli.js`, no bin; library entries (index/browser/reactnative) + `dist/fonts`/`dist/musics` still emit. Update README CLI section.
- [ ] Commit (ask first): `refactor(core)!: move the leclap CLI out to @leclap/cli`.

### Task 5: Rewire root scripts + docs

- **Files:** root `package.json`, `MIGRATION.md`, `apps/leclap-web/src/presentation/pages/Doc.tsx`.
- [ ] Root `build:exe`/`build:exe:all` → `--filter @leclap/cli`. Update `MIGRATION.md` CLI rows + the Doc page `CommandPill` to `npx @leclap/cli my-template.json`.
- [ ] Commit (ask first): `docs: point CLI usage at @leclap/cli`.

---

## Verification (end-to-end)

1. **Install/build:** `pnpm install` then `pnpm build` (`pnpm -r`) — `@leclap/cli` builds `dist/index.js` (shebang); `ffmpeg-video-composer` builds with **no** `dist/cli.js` and **no** `bin`.
2. **CLI runtime:** from repo root —
   - `node packages/leclap-cli/dist/index.js --help` / `--version` / `--diagnose` print correctly.
   - `node packages/leclap-cli/dist/index.js packages/leclap-creative-kit/src/templates/<a-template>.json` compiles a video (uses the bundled demo assets via `resolveAssetsDir`).
   - `pnpm --filter @leclap/cli exec leclap --diagnose` resolves the linked bin.
3. **Standalone binary (optional):** `pnpm --filter @leclap/cli build:exe` produces `dist/bin/*` for the three targets.
4. **Quality gates:** `pnpm check` (tsc, incl. the path alias resolves `ffmpeg-video-composer` from dist), `pnpm lint`, `pnpm test` — all green; `@leclap/cli`'s `resolveAssetsDir` tests pass.
5. **Library scope intact:** `@leclap/mcp` and `apps/leclap-web` still build and import `ffmpeg-video-composer` unchanged; `pnpm --filter @leclap/web build` succeeds with the updated Doc pill.
6. **Manifest audit:** `ffmpeg-video-composer/package.json` has no `bin`/`build:exe`/`@yao-pkg/pkg`; `@leclap/cli/package.json` has `bin.leclap` + the workspace dep.

## Notes

- **Reuses:** `@leclap/mcp` as the package scaffold (manifest/tsdown/tsconfig/vitest); the core's public API (`compile`, `loadConfig`, `FFmpegDetector`, `Terminal`); `resolveAssetsDir` logic.
- **DRY:** the standalone-binary build now targets the single tsdown-built `dist/index.js` (the duplicated `executable.js` is deleted). If `@yao-pkg/pkg` rejects ESM, fall back to a thin `executable.js` re-exporting `./dist/index.js`.
- **Out of scope:** publishing/versioning automation (none exists; CI publish is commented out), trimming now-unused core deps (`figlet`/`gradient-string`/`cli-spinners` were already unused — separate cleanup), renaming the core package.
- **Breaking change:** old `npx ffmpeg-video-composer <template>` no longer works (clean removal). The `!` in the Task 4 commit subject flags it. README/MIGRATION/docs all point to `@leclap/cli`.
- **No commit without consent:** every commit step = ask, then commit. Conventional, lowercase, short subject, no body, no trailer.
