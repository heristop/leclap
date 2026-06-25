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

## Parallel segment rendering

On Node (and ffmpeg-static), segments render concurrently by default — `hardwareConfig.maxRenderConcurrency`
(default 3, capped by segment count) controls the width; set it to `1` to force the serial path.
Build always runs serially (it mutates shared state); only the ffmpeg processes overlap. WASM and
on-device adapters drive a single engine and always render serially. For benching, the dev CLI honors
`FVC_RENDER_CONCURRENCY` (e.g. `FVC_RENDER_CONCURRENCY=1 pnpm bench fast-and-curious`). Measured
~40% faster total compile / ~50% faster render on a 3-segment template — see `docs/perf-findings.md`.

## Folded concat pass

When a template has no transitions and no animations, the standalone concat-copy pass is skipped:
the following audio pass (`appendMusic` or `normalizeAudio`) consumes the concat demuxer directly,
stream-copying video and touching only audio in one invocation. This is automatic on every platform
(Node, ffmpeg-static, React Native/on-device, and WASM — whose adapter bridges the concat segments +
music into MEMFS). It removes one full read/write of the assembled video; the saving is I/O-bound
(stream copy), so it's small on short native renders and proportionally larger on long-form output
and on WASM/on-device. Templates with transitions or animations keep the standard assemble path.
Set `FVC_DISABLE_CONCAT_FOLD=1` to force the two-pass path (bench/debug A/B). See `docs/perf-findings.md`
finding #2 and the measured A/B at the top of that doc.

## Fused transition + animation pass

When a template has **both** transitions and whole-video animations, the xfade assembly and the
animation overlay are composed into a single `-filter_complex` (one re-encode instead of two) — the
overlay chains off the xfade output. Automatic; `overlayAnimations` skips so it isn't applied twice.
Saves ~one full re-encode of the timeline (`director:finalize` −12% on the test fixture). Templates
with only transitions, only animations, or neither are unchanged. Set `FVC_DISABLE_FUSION=1` for the
two-pass path (bench/debug). See `docs/perf-findings.md` finding #4.

## Hardware encoder (opt-in)

Set `FVC_HWENCODE=1` (Node path) to auto-select a platform hardware H.264 encoder
(`h264_videotoolbox` on macOS, `h264_mediacodec` on Android) when the ffmpeg build exposes one;
or set `codecConfig.videoCodec` explicitly. It is **off by default** because benchmarks show
hardware encode is slower than libx264 `ultrafast` on short multi-segment renders (per-segment
session-setup overhead) and only ~5% faster on a single heavy encode — see `docs/perf-findings.md`.
On-device builds already use hardware/LGPL encoders, so this only affects host/Node renders.

## Turning measurements into work

See `docs/perf-findings.md` for the ranked backlog. The rule: optimize in descending order of measured wall-time share; weight serial→parallel restructuring by segment count (payoff scales with the number of segments). Kill any candidate whose measured cost is below the noise floor.
