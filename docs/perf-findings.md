# Performance findings (ranked)

Generated from `pnpm bench` measurements on the `feat/ffmpeg-effects` branch (Apple Silicon,
ffmpeg 8.1.1). Reproduce with `pnpm --filter ffmpeg-video-composer bench` and
`FVC_PERF=1 pnpm compile <fixture>`. See `docs/performance.md` for the tooling.

## Headline: FFmpeg dominates; the TS layer is noise

Measured `ffmpeg share` of total compile time:

| Fixture                    | segments | ffmpeg:execute calls | total   | ffmpeg share |
| -------------------------- | -------- | -------------------- | ------- | ------------ |
| `video`                    | 1        | 2                    | 197 ms  | 97.5%        |
| `picture`                  | 1        | 2                    | 1482 ms | 99.6%        |
| `fast-and-curious`         | 3        | 4                    | 667 ms  | 97.6%        |
| `concat-videos-with-music` | 3+       | 5                    | 1208 ms | 95.4%        |

The entire TypeScript orchestration layer — filter-graph assembly, map building, asset/font/LUT
resolution, formatting — sums to **well under 1 ms per segment** in every fixture
(`segment:filters` ≈ 0.3–0.9 ms summed across 3 segments; `segment:maps/inputs/fonts/luts` ≈ 0.0 ms).
It is three to four orders of magnitude below the ffmpeg cost.

**Conclusion: the "ffmpeg-encode-dominated" prior is confirmed.** Any real wall-time win must come
from how ffmpeg work is _scheduled_, not from optimizing TS.

## Ranked backlog

### 1. Bounded-parallel segment render — CANDIDATE (highest payoff)

`director:render` is the serial per-segment loop (`TemplateDirector.ts:263`). It runs one ffmpeg
process at a time:

- `fast-and-curious` (3 segments): `director:render` = 493 ms, ~73% of total.
- `ffmpeg:execute` is 90%+ of total and its count scales with segment count.

Rendering 2–3 segments concurrently could cut `director:render` substantially on multi-core
machines, and the payoff grows with segment count. This is the only finding with meaningful upside.

**Architectural constraint (confirmed by code inspection — not a simple loop change):**
three pieces of shared mutable state make a naive `Promise`-pool over `processSingleVideoSegment`
unsafe (it would corrupt output silently):

1. `Segment` is a **DI singleton** — `container.registerInstance('segment', new Segment())`
   (`index.ts:68`). Every `SegmentBuilder` and every manager (asset/map/filter/formatter) reads and
   mutates this one instance via `hydrate()`. **The build phase must stay serial.**
2. `TemplateConcreteBuilder` is resolved once and reused; it stores `this.segment`/`this.section`
   per call (`TemplateConcreteBuilder.ts:22-23`), so concurrent `buildPart`/`renderPart` clobber.
3. The ffmpeg adapter carries per-call `progressListener`/`expectedDurationSeconds`
   (`AbstractFFmpeg.ts:31,38`), set per segment in the loop (`TemplateDirector.ts:275-285`).

**Therefore the only safe parallelization is to decouple build from render:** build each segment
serially (cheap — sub-ms — and capture its final ffmpeg command string + destination), then run the
`ffmpegAdapter.execute()` calls through a bounded pool, then append to the concat list in segment
order. This is **Node-only**: the WASM and on-device adapters drive a single FFmpeg engine over a
shared virtual filesystem and cannot run concurrent executes.

**Recommended shape:** a `maxRenderConcurrency` knob defaulting to **1** (byte-identical to today's
serial path — zero risk unless opted in), honored only by the Node adapter. Measure with
`BENCH_RUNS=5` on `fast-and-curious` and `concat-videos-with-music`. Note the expected gain is
bounded: each ffmpeg is already multi-threaded, so on a core-saturated machine overlap buys little.

### 2. `director:finalize` / `final:assemble` — INVESTIGATE (situational)

For `concat-videos-with-music`, `director:finalize` = 720 ms (59.6%), dominated by
`final:assemble` (436 ms) — a second full re-encode pass (concat / xfade + audio mix). This is
ffmpeg time, not TS. Potential win only if the assembly re-encode can be avoided (stream copy where
no transition/normalization is needed) — a correctness-sensitive change, separate investigation.

### 3. Overlap independent per-segment fetches — WON'T DO (below noise floor)

`SegmentBuilder.ts:191-195` fetches fonts then LUTs serially. Measured `segment:fonts` and
`segment:luts` are **0.0 ms** for the local-asset fixtures. Parallelizing them saves nothing here.
_Caveat:_ these are network-bound for remote assets — re-measure with a remote-asset descriptor
before fully dismissing; the local-fixture data cannot speak to that case.

### 4. TS micro-optimizations — WON'T DO (below noise floor)

All of the static-analysis candidates target code measured at sub-millisecond totals, so the
expected win is unmeasurable against ffmpeg variance. Kept here only to record they were evaluated
and rejected _with data_:

- RegExp recompiled per input in a loop — `MapManager.ts:~298,305`
- `+=` string building in loops — `MapManager.ts:~34,38`, `MusicComposer.ts:~312-323`
- large `.join()` filtergraphs — `SegmentBuilder.ts:514-542`
- `unshift()` in loops — `MapManager.ts:~90,144,193`
- repeated `Object.keys()` / hot-array `.includes()` — `MapManager.ts:~285,290`, `FormatterManager.ts:~278`
- per-call color regex — `FormatterManager.ts:~306`

These would only matter for a descriptor with hundreds of filters per segment; if such a workload
appears, re-measure `segment:filters`/`segment:maps` first and only then act on the specific span
that grows.

## Phase 2 recommendation

Implement **only finding #1** (bounded-parallel render) as the first Phase 2 task, verifying the
`director:render` delta with `pnpm bench`. Treat #2 as a separate, correctness-gated investigation.
Do not implement #3/#4 — the data does not justify them.
