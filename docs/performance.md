# Performance & profiling

How to measure where a compile spends its time and turn that into ranked optimizations.

## TL;DR

- `FVC_PERF=1 pnpm compile <template.json>` — print a per-phase timing table and write `build/perf-<name>.json`.
- `pnpm --filter ffmpeg-video-composer bench` — median per-phase wall time across fixtures, with FFmpeg-share % and a delta vs. the previous run.
- Profiling the TS layer is rarely worth it: measurements show FFmpeg is **95–99% of wall time** (see `docs/perf-findings.md`).

## Phase timing (`FVC_PERF`)

The pipeline is instrumented with a lightweight, gated timer (`src/utils/perf-timer.ts`). It is a **no-op unless `FVC_PERF` is set** to a truthy value other than `0`, so normal compiles and the test suite pay only a boolean check.

```bash
FVC_PERF=1 pnpm compile packages/ffmpeg-video-composer/tests/fixtures/fast-and-curious.json
```

Emits a table like:

```
total 666.9ms · ffmpeg share 97.6%
compile:total        666.0ms   1x   99.9%
ffmpeg:execute       603.3ms   4x   90.5%
director:render      493.1ms   1x   73.9%
director:finalize    172.3ms   1x   25.8%
final:assemble       171.7ms   1x   25.8%
segment:filters        0.9ms   3x    0.1%
...
```

and writes the same data as JSON to `build/perf-<descriptor-name>.json` (override the path with `FVC_PERF_OUT=<path>`).

### Span labels

| Label                                             | Covers                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| `compile:total`                                   | the whole `director.construct()`                  |
| `director:init`                                   | concat-file + music setup                         |
| `director:calculateTotalLength`                   | duration probing (parallel)                       |
| `director:render`                                 | the serial per-segment render loop                |
| `director:finalize`                               | assembly + animations + music                     |
| `segment:{assets,maps,filters,inputs,fonts,luts}` | per-segment build stages (summed across segments) |
| `ffmpeg:execute` / `ffmpeg:getInfos`              | each ffmpeg / ffprobe child process               |
| `final:assemble`                                  | concat or xfade transition assembly               |
| `final:animations` / `final:music`                | whole-video overlay / audio mix                   |

`ffmpeg share %` is the fraction of `compile:total` spent inside `ffmpeg:*` spans — the single most important number.

## Benchmark harness (`pnpm bench`)

```bash
pnpm --filter ffmpeg-video-composer bench                 # default curated fixtures
pnpm --filter ffmpeg-video-composer bench gradient transitions   # specific fixtures
BENCH_RUNS=5 pnpm --filter ffmpeg-video-composer bench    # more runs (median; run 0 is warmup)
```

The harness (`scripts/bench.ts`) runs each fixture through the **built CLI** `RUNS` times, discards a warmup, and reports the **median** per phase. It writes `build/bench-<gitsha>.json` and prints a delta table vs. the most recent previous bench file, so a change's effect is visible immediately.

Notes:

- It shells out to `dist/` (auto-building if missing) rather than importing `src` via `tsx`, because tsyringe constructor injection needs `emitDecoratorMetadata`, which esbuild/tsx does not emit but tsdown does.
- Numbers are I/O/CPU-noisy (real ffmpeg processes). Read the median, note the machine, and treat per-phase deltas under the noise floor as non-actionable.
- Fixtures that fail to render are logged as skipped (no silent caps).

## CPU profiling the TS layer

Only worth it when `FVC_PERF` shows the TS layer is a meaningful share (it currently is not). Built-in, no extra deps:

```bash
pnpm --filter ffmpeg-video-composer build
FVC_PERF=1 node --cpu-prof --cpu-prof-dir=build/prof \
  packages/ffmpeg-video-composer/compile.ts \
  packages/ffmpeg-video-composer/tests/fixtures/drink-and-code.json
# open build/prof/*.cpuprofile in Chrome DevTools (Performance → Load profile) or VS Code
```

For flamegraphs, add `0x` as a devDependency **only if** the data justifies deeper digging — it is intentionally not committed by default.

## Turning measurements into work

See `docs/perf-findings.md` for the ranked backlog. The rule: optimize in descending order of measured wall-time share; weight serial→parallel restructuring by segment count (payoff scales with the number of segments). Kill any candidate whose measured cost is below the noise floor.
