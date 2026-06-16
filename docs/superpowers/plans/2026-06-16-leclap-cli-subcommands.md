# `leclap` umbrella CLI (subcommands) + /doc dev resources — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **On start, copy this plan to `docs/superpowers/plans/2026-06-16-leclap-cli-subcommands.md`** (plan was authored in plan mode where only the scratch plan file was writable).
>
> **For the /doc UI task:** apply the `impeccable` + `ui-ux-pro-max` skills (reuse the design system; the `CommandPill` already exists).

## Context

`@leclap/cli` (`packages/leclap-cli`, just extracted from the engine) is today a flag-based compile tool: `leclap <template.json>`, `leclap --diagnose`, `--help`, `--version`. The user wants the `leclap` CLI to be the **primary developer entry point** (`ffmpeg-video-composer` stays as the legacy _engine_ name underneath), modeled on Remotion — which ships a real _tool_ (`remotion render`, `remotion studio`, …) plus a _scaffolder_ (`create-video`).

**Goal:** restructure `leclap` into a **subcommand umbrella** so it reads as a dev tool with room to grow, and add the missing "create" half:

- `leclap render <template.json>` — compile (today's behavior).
- `leclap init [name]` — scaffold a ready-to-run starter project (the `create-video` analog).
- `leclap diagnose` — system diagnostics.
- `leclap --help` / `--version` — auto-generated.
- **Bare-path shorthand kept:** `leclap my-template.json` still renders (back-compat + ergonomics); `leclap` with no args prints help.

Then **update the web `/doc` dev resources** (the CLI `CommandPill`) to teach the new commands.

**Decisions (locked with user):** parser = **citty** (unjs); keep the **bare-path shorthand**; `init` scaffolds a **full starter** (template.json + assets/ + README + package.json with a `render` script).

**Tech stack:** pnpm workspace, tsdown (ESM/node), citty, tsc, vitest (`vp`). The render/diagnose logic + `resolveAssetsDir` already exist in `packages/leclap-cli/src/index.ts` — they move into commands unchanged.

## Architecture & reuse

`citty` gives typed subcommands, per-command `--help`, option parsing, and auto `--version` from `meta`. Shape:

```ts
// src/index.ts
import { defineCommand, runMain } from 'citty';
import { rewriteArgv } from './args';
const main = defineCommand({
  meta: { name: 'leclap', version, description: 'Create videos from JSON templates' },
  subCommands: {
    render: () => import('./commands/render').then((m) => m.render),
    init: () => import('./commands/init').then((m) => m.init),
    diagnose: () => import('./commands/diagnose').then((m) => m.diagnose),
  },
});
runMain(main, { rawArgs: rewriteArgv(process.argv.slice(2), KNOWN_COMMANDS) });
```

- **Bare-path shorthand** is a pure preprocess (`rewriteArgv`): if the first token isn't a known subcommand and isn't a flag, prepend `render`. _TDD target._
- **render** reuses the existing `buildProjectConfig` / `validateAndLoadTemplate` / `runCompilation` / `handleCompileError` / `handleFFmpegError` (lifted from `src/index.ts`), importing `compile`/`loadConfig` from `ffmpeg-video-composer` and `resolveAssetsDir` locally.
- **diagnose** reuses the existing `runDiagnostics` (FFmpegDetector + Terminal).
- **init** writes a self-contained starter (a color-background + text intro template that needs no external media) via an injectable writer. _TDD the file-set generator._
- citty's auto help/version **replaces** the hand-rolled `showHelp`/`showVersion`. Shared `printTitle`/`printBox` (and any banner) move to `src/ui.ts`.

---

## File map

**`packages/leclap-cli/`:**

- `package.json` — add `citty` to `dependencies`; add `citty` to the tsdown `external` list.
- `tsdown.config.ts` — add `'citty'` (and `node:fs`, `node:fs/promises` already present) to `neverBundle`.
- **Create** `src/args.ts` (+ `tests/args.test.ts`) — `rewriteArgv(argv, known)`. _TDD._
- **Create** `src/ui.ts` — `printTitle`, `printBox` (+ any shared banner helpers).
- **Create** `src/commands/render.ts` — citty `render` command (logic lifted from current `src/index.ts`).
- **Create** `src/commands/diagnose.ts` — citty `diagnose` command (lifted `runDiagnostics`).
- **Create** `src/commands/init.ts` (+ `tests/init.test.ts`) — citty `init`; the scaffold file-set comes from a pure `starterFiles(name)` helper writing through an injected writer. _TDD._
- **Rewrite** `src/index.ts` — the citty `main` + `runMain`/`rewriteArgv` wiring; remove the old switch/help/version/compile bodies (moved).
- `src/resolveAssetsDir.ts` — unchanged.
- `tests/cli-entry.test.ts` — update: assert `render` exits non-zero when `compile` resolves null (call `render.run({ args: { template: 'x' } })` with `ffmpeg-video-composer` mocked).
- `tests/cli-bundle.test.ts` — update the subprocess invocation to `node dist/index.js render <fixture>` (and add a bare-path variant `node dist/index.js <fixture>`).
- `README.md` — document the subcommands (`render`, `init`, `diagnose`) + the bare-path shorthand.

**Web `/doc` (apps/leclap-web):**

- `src/presentation/pages/Doc.tsx` — replace the single `CommandPill` with a small **"Get started with the CLI"** group: `npx @leclap/cli init my-video` (scaffold) then `leclap render template.json` (compile), plus a `leclap diagnose` hint. Reuse `CommandPill` (one per command) in a tidy stack; impeccable/ui-pro-max.

**Docs references:** `packages/ffmpeg-video-composer/README.md` + `MIGRATION.md` — `npx @leclap/cli my-template.json` → `npx @leclap/cli render my-template.json` (or the bare form); add `init`/`diagnose` mentions where the CLI is described.

---

## Tasks

### Task 1: `rewriteArgv` bare-path preprocess (TDD)

- **Files:** create `src/args.ts` + `tests/args.test.ts`.
- [ ] Failing tests: `rewriteArgv(['x.json'], known)` → `['render','x.json']`; known subcommands pass through (`['render','x.json']`, `['init','foo']`, `['diagnose']` unchanged); flags pass through (`['--help']`, `['--version']`, `[]` unchanged); a non-command non-flag token (`['typo']`) → `['render','typo']`.
- [ ] Implement the pure function (guard clauses, no `else`). Export `KNOWN_COMMANDS`.
- [ ] Verify pass. Commit (ask first): `feat(cli): bare-path render shorthand`.

### Task 2: citty scaffolding + `render` + `diagnose`

- **Files:** add `citty` dep; create `src/ui.ts`, `src/commands/render.ts`, `src/commands/diagnose.ts`; rewrite `src/index.ts`; update `tsdown.config.ts`; update `tests/cli-entry.test.ts`, `tests/cli-bundle.test.ts`.
- [ ] `pnpm --filter @leclap/cli add citty`. Add `citty` to tsdown `neverBundle`.
- [ ] Move `printTitle`/`printBox` → `src/ui.ts`. Build `render` (positional `template`, reuses the compile pipeline) and `diagnose` (reuses `runDiagnostics`). Wire `src/index.ts` with `defineCommand` + `runMain(main, { rawArgs: rewriteArgv(...) })`.
- [ ] Update `cli-entry.test.ts` (call `render.run` with mocked core) and `cli-bundle.test.ts` (`render <fixture>` + bare `<fixture>`).
- [ ] `pnpm --filter @leclap/cli build` then `node dist/index.js --help` lists `render`/`init`/`diagnose`; `node dist/index.js render <creative-kit template>` renders; bare `node dist/index.js <template>` renders; `--version` works. Commit (ask first): `feat(cli): citty subcommands (render, diagnose)`.

### Task 3: `leclap init` scaffolder (TDD)

- **Files:** create `src/commands/init.ts` + `tests/init.test.ts`.
- [ ] Failing tests for a pure `starterFiles(projectName)` → a `{ path → contents }` map containing `template.json` (a valid descriptor — verify it parses), `README.md`, `package.json` (with `"render": "leclap render template.json"` + `@leclap/cli` devDep), and an `assets/.gitkeep`. Assert no file escapes the project dir.
- [ ] Implement `init` as a citty command (positional `name`, default `my-leclap-video`): create the dir, refuse to overwrite a non-empty target, write `starterFiles` through `node:fs/promises`, then print next-steps (`cd <name> && npx @leclap/cli render template.json`).
- [ ] Verify: `node dist/index.js init demo` in a temp dir produces the files and `leclap render demo/template.json` compiles. Commit (ask first): `feat(cli): leclap init scaffolder`.

### Task 4: package README + docs references

- **Files:** `packages/leclap-cli/README.md`, `packages/ffmpeg-video-composer/README.md`, `packages/ffmpeg-video-composer/MIGRATION.md`.
- [ ] Document the subcommands + bare-path shorthand in the CLI README; update the core README/MIGRATION CLI lines to `leclap render` / mention `init`.
- [ ] Commit (ask first): `docs(cli): document leclap subcommands`.

### Task 5: web /doc dev resources (UI skills)

- **Files:** `apps/leclap-web/src/presentation/pages/Doc.tsx`.
- [ ] Replace the lone CLI pill with a compact **Get started** stack (apply impeccable/ui-pro-max): pills for `npx @leclap/cli init my-video` and `leclap render template.json`, plus a muted `leclap diagnose` hint. Keep copy tight; light + dark; reuse `CommandPill`.
- [ ] `tsc --noEmit` + `pnpm lint` clean; eyeball in `pnpm playground:web`. Commit (ask first): `feat(web): cli get-started block on the docs page`.

---

## Verification (end-to-end)

1. **Unit:** `pnpm --filter @leclap/cli test` — `args`, `init` (starterFiles), `resolveAssetsDir`, `cli-entry`, `cli-bundle` all green.
2. **CLI runtime (after `pnpm --filter @leclap/cli build`):**
   - `node dist/index.js` → help listing `render`/`init`/`diagnose`; `--version` prints the version.
   - `node dist/index.js render packages/leclap-creative-kit/src/templates/intro.json` → renders an mp4.
   - bare `node dist/index.js <template.json>` → renders (shorthand).
   - `node dist/index.js init demo` (in a temp dir) → scaffolds; `leclap render demo/template.json` compiles.
   - `node dist/index.js diagnose` → FFmpeg report.
3. **Gates:** `pnpm check` (tsc), `pnpm lint`, the full `pnpm -r test` — green. `pnpm --filter @leclap/web exec tsc --noEmit` clean (Doc change).
4. **Standalone binary still builds:** `pnpm --filter @leclap/cli build:exe` (targets `dist/index.js`).
5. **Docs:** `/doc` shows the get-started CLI block; commands copy correctly.

## Notes

- **Reuses:** the existing render/diagnose pipeline + `resolveAssetsDir` (moved, not rewritten); the `CommandPill` component; the `@leclap/mcp`-style package conventions.
- **citty** is unjs (matches tsdown/rolldown); marked `external` so it stays a node_modules dep (not bundled). Auto `--help`/`--version` replace the hand-rolled versions.
- **Back-compat:** the bare-path shorthand keeps `leclap <template>` (and the old docs pill form) working; `leclap render <template>` is the canonical form.
- **Out of scope:** a `watch`/studio dev server, `validate`, or lambda-style remote render (future subcommands the umbrella now allows); publishing automation.
- **No commit without consent:** every commit step = ask, then commit. Conventional, lowercase, short subject, no body, no trailer.
