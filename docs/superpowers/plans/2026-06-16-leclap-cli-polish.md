# Subtle CLI UI/UX polish (`leclap`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **On start, copy this plan to `docs/superpowers/plans/2026-06-16-leclap-cli-polish.md`.** Apply restrained CLI-UX taste: one consistent symbol/color vocabulary, quiet by default, no flashy banners/gradients.

## Context

`leclap` works, but its terminal output is rough. Two problems:

1. **The engine floods the terminal with raw JSON.** `PinoLogAdapter` (`packages/ffmpeg-video-composer/src/platform/logging/PinoLogAdapter.ts`) does `pino()` with no config → level `info`, JSON format. Every `render` prints dozens of `{"level":30,"time":…,"msg":"[video_1][Fonts] fetched"}` lines, drowning the CLI's own output. There's **no level control** (no env var, no option).
2. **The commands' voice is inconsistent and over-enthusiastic.** `render` has ad-hoc `console.log`s ("Welcome to LeClap!", "✨ Creating video magic…", "🎞️ Processing your video magic…", "✅ 🎉 Compilation completed successfully!"); `diagnose`/`init` use a different lightweight `ui.ts`. No progress feedback during the multi-second compile (just JSON spam, then a done line).

**Goal:** a _subtle_, professional polish — silence the engine's logs during CLI runs, show a single tasteful **spinner** while rendering, and give `render`/`init`/`diagnose` one consistent, restrained voice (a small symbol set, calm copy, render duration). No new flashy deps; reuse the core `Terminal` (spinner/success/error — picocolors-only) and `picocolors`.

**Non-goals:** figlet/gradient banners, ASCII art, animated type-on. Keep it understated.

## Architecture & reuse

- **Engine quiet:** make `PinoLogAdapter`'s level configurable via env (`pino({ level: process.env.LECLAP_LOG_LEVEL || 'info' })`) — **back-compat** (library default stays `info`). The CLI sets `process.env.LECLAP_LOG_LEVEL = 'silent'` before `compile()` (and `'info'` under `--verbose`), so the engine is silent and the CLI owns all output.
- **Reuse the core `Terminal`** (`ffmpeg-video-composer` export; `src/utils/terminal.ts`): `startSpinner(msg)` / `stopSpinner('success'|'error', msg)` for the render progress, `showError(msg, tips[])` / `showSuccess(msg)` for results. Picocolors-only — no new CLI deps.
- **One CLI vocabulary** in `src/ui.ts`: a small set of styled line helpers (success `✓`, fail `✗`, step `›`, hint, a `heading`) as **pure formatters** returning strings (the commands `console.log` them) so they're unit-testable.

---

## File map

**`packages/ffmpeg-video-composer/`:**

- `src/platform/logging/PinoLogAdapter.ts` — `pino({ level: process.env.LECLAP_LOG_LEVEL || 'info' })`. (+ a small test that the level is honored.)

**`packages/leclap-cli/`:**

- `src/ui.ts` — replace `printTitle`/`printBox` with a consistent vocabulary: `heading(text)`, `success(text)`, `fail(text)`, `step(text)`, `hint(text)` (pure → styled string), keeping output calm. (+ `tests/ui.test.ts`, TDD the formatters.)
- `src/log.ts` (new) — `setEngineLogLevel(level)` tiny helper that sets `process.env.LECLAP_LOG_LEVEL` (one place; documents intent).
- `src/commands/render.ts` — set engine log level (`silent`, or `info` when `--verbose`); wrap `compile()` in a `Terminal` spinner ("Rendering <basename(template)>…"); on success `✓ Rendered → <output>  <duration>`; on failure stop the spinner + `Terminal.showError` with tips. Drop the welcome/"video magic"/processing chatter. Add a `--verbose` boolean arg.
- `src/commands/init.ts` — use the new vocabulary: `✓ Created <name>`, a calm "Next steps" block (`step` lines).
- `src/commands/diagnose.ts` — use `heading` + the shared symbols; keep `Terminal.showSuccess` for the ready state; align the "setup required" line to the `fail`/`hint` style.
- `src/index.ts` — tighten `meta.description`s for a cleaner citty `--help` (root + each subcommand + arg descriptions).
- `tests/cli-bundle.test.ts` — update the success-string assertion (`Compilation completed successfully` → the new `Rendered` wording).
- `tests/cli-entry.test.ts` — the thrown `'Compilation failed to produce output'` message is unchanged; keep the assertion (adjust the success-negative string to the new wording).

---

## Tasks

### Task 1: configurable engine log level (core, TDD)

- **Files:** `packages/ffmpeg-video-composer/src/platform/logging/PinoLogAdapter.ts` (+ a test).
- [ ] Test: a `PinoLogAdapter` built with `LECLAP_LOG_LEVEL=silent` has its pino `level === 'silent'`; default (unset) is `'info'`. (Assert via the adapter's logger level.)
- [ ] Implement `pino({ level: process.env.LECLAP_LOG_LEVEL || 'info' })`. Verify the core test suite still passes (no behavior change at default).
- [ ] Commit (ask first): `feat(core): configurable log level via LECLAP_LOG_LEVEL`.

### Task 2: CLI output vocabulary (TDD)

- **Files:** rewrite `packages/leclap-cli/src/ui.ts` (+ `tests/ui.test.ts`); add `src/log.ts`.
- [ ] Failing tests for the pure formatters: `success('done')` contains `✓` and `done`; `fail('x')` contains `✗`; `step('go')` contains the step glyph; `heading('Title')` contains the text. (Substring assertions — color codes don't matter.)
- [ ] Implement the vocabulary (picocolors: green `✓`, red `✗`, dim/cyan accents). Add `setEngineLogLevel(level)` in `src/log.ts`.
- [ ] Verify pass. Commit (ask first): `feat(cli): consistent output vocabulary`.

### Task 3: render — quiet logs + spinner + duration

- **Files:** `packages/leclap-cli/src/commands/render.ts`; `tests/cli-bundle.test.ts`, `tests/cli-entry.test.ts`.
- [ ] At the top of `run`, `setEngineLogLevel(args.verbose ? 'info' : 'silent')`. Add the `verbose` boolean arg. When not verbose, drive `Terminal.startSpinner('Rendering <basename>…')` around `compile()` and `stopSpinner('success', …)`; when verbose, skip the spinner (let engine logs flow). Replace the chatty logs with: a calm start, then `✓ Rendered → <output>  <Xs>` (time via `Date.now()` around the compile). On error: `stopSpinner('error', …)` + `Terminal.showError(message, tips)` (tips reference `leclap diagnose`).
- [ ] Update `cli-bundle.test.ts` to assert the new success wording; keep `cli-entry.test.ts`'s thrown-message assertion, adjust the success-negative string.
- [ ] Build + `node dist/index.js render <intro.json>` shows a clean spinner→`✓ Rendered` with **no JSON**; `--verbose` shows engine logs. Commit (ask first): `feat(cli): quiet, spinner-driven render output`.

### Task 4: init + diagnose + help consistency

- **Files:** `src/commands/init.ts`, `src/commands/diagnose.ts`, `src/index.ts`.
- [ ] `init`: `✓ Created <name>` + a calm "Next steps" (`step` lines) using the vocabulary. `diagnose`: `heading` + shared symbols; keep `Terminal.showSuccess`. `index.ts`: tighten `meta` descriptions so `leclap --help` reads cleanly.
- [ ] Build + smoke `init demo`, `diagnose`, `--help`. Commit (ask first): `feat(cli): consistent init/diagnose output + tighter help`.

---

## Verification (end-to-end)

1. **Unit:** `pnpm --filter @leclap/cli test` (ui formatters, args, init, render-command, cli-bundle) + `pnpm --filter ffmpeg-video-composer test` (incl. the new log-level test) — green.
2. **The JSON-flood is gone:** `pnpm --filter @leclap/cli build` then `node packages/leclap-cli/dist/index.js render packages/leclap-creative-kit/src/templates/intro.json` shows a spinner then `✓ Rendered → …/build/output.mp4 (Xs)` and **no `{"level":…}` lines**.
3. **Verbose still works:** `… render <intro.json> --verbose` surfaces the engine logs (for debugging).
4. **Other commands:** `init demo` → `✓ Created demo` + next steps; `diagnose` → clean report; `--help` lists `render`/`init`/`diagnose` with crisp descriptions.
5. **Library back-compat:** with `LECLAP_LOG_LEVEL` unset, the engine still logs at `info` (existing consumers unaffected) — covered by the core test + unchanged core suite.
6. **Gates:** `pnpm --filter @leclap/cli exec tsc --noEmit`, `pnpm lint` clean on touched files.

## Notes

- **Reuses:** the core `Terminal` (spinner/success/error) and `picocolors` — no new CLI deps; the `LECLAP_LOG_LEVEL` env var also benefits `@leclap/mcp` and other consumers.
- **Subtle by design:** silence + one spinner + a tidy symbol set + render duration. No banners/gradients/animations.
- **Back-compat:** engine logging defaults unchanged; only the CLI opts into `silent`.
- **No commit without consent:** every commit step = ask, then commit. Conventional, lowercase, short subject, no body, no trailer.
