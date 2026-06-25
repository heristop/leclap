# Performance findings (ranked)

Generated from `pnpm bench` measurements on the `feat/ffmpeg-effects` branch (Apple Silicon,
ffmpeg 8.1.1). Reproduce with `pnpm --filter ffmpeg-video-composer bench` and
`FVC_PERF=1 pnpm compile <fixture>`. See `docs/performance.md` for the tooling.

## Measured benchmarks (A/B)

Median of 5 runs (1 warmup discarded), Apple Silicon (`J4MPHVYFP0`), ffmpeg 8.1.1. No Rust changes —
both wins are in the TypeScript orchestration layer. FFmpeg remains 78–98% of wall time.

### 1. Parallel segment render — `fast-and-curious` (3 segments)

Toggle: `FVC_RENDER_CONCURRENCY=1` (serial) vs `=3` (default).

| phase                         | serial (1)  | parallel (3)     | delta      |
| ----------------------------- | ----------- | ---------------- | ---------- |
| `compile:total`               | 853 ms      | 563 ms           | **−34%**   |
| `director:render`             | 518 ms      | 259 ms           | **−50%**   |
| `ffmpeg:execute` (concurrent) | 789 ms (4×) | 395 ms (2× wall) | overlapped |

The render phase halves; total drops a third. Gain scales with segment count and shrinks on a
core-saturated machine (each ffmpeg is already multi-threaded).

### 2. Hardware encoder (videotoolbox) — opt-in, NOT default

Toggle: default (libx264 `ultrafast`) vs `FVC_HWENCODE=1` (auto-selects `h264_videotoolbox` on macOS).

| fixture                               | libx264 | videotoolbox | verdict         |
| ------------------------------------- | ------- | ------------ | --------------- |
| `fast-and-curious` (3 short segments) | 614 ms  | 1034 ms      | **+68% slower** |
| `picture` (1 heavy encode)            | 1711 ms | 1626 ms      | ~5% faster      |

Hardware encode has per-invocation session-setup overhead, so it **loses on short multi-segment
renders** (the common case — each segment pays the setup) and only marginally wins on a single heavy
encode. Conclusion: **keep it opt-in** (`FVC_HWENCODE=1`, or set `codecConfig.videoCodec` explicitly)
rather than auto-on. The detection infra ships regardless: `FFmpegDetector.listEncoders()` +
`selectVideoCodec(available, platform)` (videotoolbox/mediacodec/libx264). On-device already uses
hardware/LGPL encoders, so this only concerns the host/Node path.

### 3. Concat fold — `concat-music-cuts` (3 segments, music, cuts)

Toggle: `FVC_DISABLE_CONCAT_FOLD=1` (two-pass) vs default (folded).

| phase                          | unfolded | folded   | delta                      |
| ------------------------------ | -------- | -------- | -------------------------- |
| `final:assemble` (concat copy) | 69 ms    | — (gone) | eliminated                 |
| `director:finalize`            | 363 ms   | 300 ms   | **−17%**                   |
| `compile:total`                | 1339 ms  | 1182 ms  | −12% (within render noise) |

The fold removes the standalone concat-copy pass entirely (here ~69 ms). It's a **stream-copy**, so
the saving is I/O-bound — small on short native clips, proportional to output size on long-form, and
larger on WASM/on-device (one fewer full MEMFS write+read + engine invocation). Treat the total-time
delta as noisy on this short fixture; the reliable figure is the eliminated `final:assemble` pass.

### 4. Finalize fusion (xfade + overlay) — DONE

**Implemented.** When a template has both transitions and whole-video animations, `assembleWithTransitions`
now weaves the overlay graph onto the xfade output (`[vfx]` → overlay → `[vout]`) in one
`-filter_complex`, so the two video re-encodes collapse to one; `overlayAnimations` skips (it would
double-apply). Animation `-i` inputs are appended after the segment+silent inputs (legs reference
`[inputOffset+k:v]`) with a distinct `ov` chain prefix to avoid colliding with the xfade `[v{k}]`
labels; animation `-t` bounds come from an analytically-computed assembled duration (no file probe).
The audio/music pass is untouched (`-c:v copy`). Toggle `FVC_DISABLE_FUSION=1` for the two-pass path.

A/B on `transitions-animations.json` (3 sections, fade, one `light_leak.apng`, music+loudnorm),
median of runs, `FVC_PERF=1`:

| phase                                          | unfused | fused    | delta           |
| ---------------------------------------------- | ------- | -------- | --------------- |
| `final:assemble` (xfade [+overlay when fused]) | 537 ms  | 1463 ms  | absorbs overlay |
| `final:animations` (overlay re-encode)         | 1203 ms | — (gone) | eliminated      |
| `director:finalize`                            | 2479 ms | 2172 ms  | **−12%**        |

Two video re-encodes (537 + 1203 = 1740 ms) become one (1463 ms) — ~280 ms of redundant
re-encode removed, `director:finalize` −12%. `compile:total` is render-noise-dominated on this
fixture (segment renders dwarf the delta), so finalize is the reliable measure. Applies only to
templates with transitions **and** animations; all other paths unchanged. Full e2e suite green.

### 5. Cross-segment remote-asset prefetch — WON'T DO (no measurable headroom)

Gate (static analysis of `AssetManager`): the per-segment fetches are already parallel internally
(`Promise.all` over assets/fonts/LUTs), and across segments the cost is already near-zero because:
media assets are **cached cross-segment** in the template singleton (`AssetManager.ts:207-209` — a
repeated `videoUrl` isn't re-downloaded), fonts are **bundled-first** then disk-cached
(`resolveBundledFont` → `copy`), and **LUTs are generated locally** (`cubeFor`), never fetched. No
remote (`https://`) fixtures exist, and a real network benchmark here is flaky/unrepresentative. So
the only workload with headroom is many segments each pulling a _distinct_ remote video — not the
common case. Recorded as won't-do; revisit (the up-front parallel prefetch in the plan, Task C2) only
if a real remote-heavy template shows `segment:assets`/`segment:fonts` as a meaningful share.

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

### 1. Bounded-parallel segment render — DONE (default-on, Node/static)

**Implemented.** Segments now build serially (the shared `Segment` DI singleton forbids concurrent
builds) then render through a bounded pool, capped by `hardwareConfig.maxRenderConcurrency`
(default 3, capped by segment count), honored only by adapters that spawn independent processes
(`supportsConcurrentExecute` — Node/static; WASM/on-device stay serial). Segments that resolve to
the same output path (duplicate section names) fall back to serial to avoid concurrent writes.

Measured on `fast-and-curious` (3 segments, median of 2, Apple Silicon, ffmpeg 8.1.1):

|                                    | total  | director:render | ffmpeg share |
| ---------------------------------- | ------ | --------------- | ------------ |
| serial (`maxRenderConcurrency: 1`) | 902 ms | 528 ms          | 97.4%        |
| parallel (default 3)               | 545 ms | 263 ms          | 80.2%        |

≈ **40% faster total, ≈50% faster render phase**. Gain scales with segment count and shrinks on
core-saturated machines (each ffmpeg is already multi-threaded). Full e2e suite stays green.

#### Original analysis

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

### 2. Fold the concat pass into the audio pass — DONE (all platforms)

**Implemented.** Audit finding: post-render video is already stream-copied everywhere valid
(`concat`, `appendMusic`, `normalizeAudio` all use `-c:v copy`); the only full re-encodes are xfade
transitions and animation overlays, which are mandatory frame compositing. The remaining waste was a
**separate concat-copy pass**: concat wrote the whole assembled video (`-c copy`), then the next
audio pass moved it aside, re-read it, and rewrote it just to touch audio. When there are no
transitions and no animations, the director now skips the standalone concat and feeds the concat
demuxer (`-f concat … -i <list>`) straight into the single audio pass, which stream-copies video and
mixes/normalizes audio in one invocation (`appendMusic`/`normalizeAudio` accept a `VideoSource`).
The music filtergraph's `[0:a]`/`[1:a]` indices are unchanged.

**All platforms** (Node, ffmpeg-static, React Native/on-device, WASM): the fold is one ffmpeg
invocation; `FFmpegWasmAdapter.execute` already bridges concat-list segments + the music input into
MEMFS generically, so no virtual-FS gate is needed. (WASM e2e is env-blocked here; WASM correctness
rests on the adapter's bridging tests + the shared command builder.)

**Honest sizing (corrected):** the concat pass is **stream-copy**, not a re-encode — it's I/O-bound.
Measured on `concat-music-cuts` (3×4s, music, cuts): the standalone concat-copy ran **~60 ms**, and
folding it away makes `director:finalize` collapse to just `final:music` (~296 ms) with no separate
`final:assemble`. So the native wall-clock win is **modest and proportional to output size**
(tens of ms on short clips, more on long-form). It is **proportionally larger on WASM/on-device**,
where it removes a full extra MEMFS write+read of the assembled video and one engine invocation.
Beyond speed, it's a structural simplification (one fewer pass / temp file).

> Note: an earlier draft mis-attributed a ~1 s `final:assemble` to the concat copy — that figure was
> the **xfade re-encode** in a transitions fixture (`concat-videos-with-music` carries a global fade),
> which this fold deliberately does **not** touch. Transition/animation re-encodes remain the large,
> unavoidable finalize costs; fusing them into a single filtergraph is a separate, higher-risk lever.

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
