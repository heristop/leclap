# ⚙️ Engine Configuration

The host-supplied half of a compile — everything the template descriptor doesn't carry: build/output paths, encoder choice, render-quality tier, and a handful of environment-variable escape hatches for benchmarking. This is the `ProjectConfig` reference; for the descriptor itself see [`template-configuration.md`](./template-configuration.md).

- **Source of truth:** [`packages/ffmpeg-video-composer/src/core/types.d.ts`](../packages/ffmpeg-video-composer/src/core/types.d.ts) (`ProjectConfig`) and [`core/default.config.ts`](../packages/ffmpeg-video-composer/src/core/default.config.ts) (fallback values).
- **Tier tables & encoder args:** [`core/encoding.ts`](../packages/ffmpeg-video-composer/src/core/encoding.ts).

## `ProjectConfig` surface

All fields are optional; unset ones fall back to `DefaultConfig`. Alongside `buildDir`/`assetsDir`/`music`/`fields`/`currentLocale`/`userVideoPaths`, the render-affecting fields are:

### `qualityTier`

`'draft' | 'standard' | 'high'` — a named render-quality tier resolved by `resolveTier` in `core/encoding.ts`. An unrecognised or unset value (including a bad JSON-sourced string) falls back to `'standard'` via an `isQualityTier` guard, rather than key-missing into the tier tables and producing `-crf undefined`. `'standard'` reproduces the historical hardcoded encoder args byte-for-byte, so existing callers see unchanged output.

Templates never carry crf/preset/bitrate directly — encoder numbers stay an app/host concern, resolved per tier (see [Encoder selection & tiers](#encoder-selection--tiers)).

### `skipValidation`

`boolean` — skips schema validation of the `TemplateDescriptor` before compiling. Trusted-caller opt-out only (e.g. a descriptor already validated upstream); validation is **on by default**. Applies to the **Node `compile()` path only** — the browser (`compileBrowser`) and React Native (`compileReactNative`) paths always validate, regardless of this flag.

### `codecConfig` / `hardwareConfig` / `audioConfig` / `videoConfig`

- `codecConfig: { videoCodec?, audioCodec? }` — explicit encoder override; see [Encoder selection & tiers](#encoder-selection--tiers).
- `hardwareConfig: { hwaccel?, preset?, maxRenderConcurrency? }` — `preset` overrides the resolved tier's default libx264 preset when set; `maxRenderConcurrency` controls parallel segment rendering (below).
- `audioConfig: { sampleRate?, channelLayout? }`.
- `videoConfig: { orientation?, scale?, setsar?, fps? }` — `orientation`, `scale`, and `fps` are normally resolved from the descriptor's `global.orientation`/`global.fps` (see [Descriptor-side knobs](#descriptor-side-knobs)) rather than set directly on the host config.

### Orientation → scale, and `fps` precedence

`TemplateDirector.init()` resolves both, once, right after `project.applyDefault()` — before any segment builds — so every segment and the final assembly see the same resolved `videoConfig`:

- **Orientation → scale** (`resolveOrientationScale`): `global.orientation === 'square'` forces the fixed `1080:1080` square preset; `'portrait'` swaps the configured `width:height` scale to `height:width`; `'landscape'` (default, `1280:720`) leaves the scale untouched.
- **`fps` precedence** (`resolveFps`): the descriptor's `global.fps` wins over any host-supplied `videoConfig.fps` whenever the descriptor sets one; every consumer reads `videoConfig.fps ?? 30` (the default).

### `maxRenderConcurrency`

Max segments rendered in parallel, read from `hardwareConfig.maxRenderConcurrency`. Only takes effect on adapters whose FFmpeg backend supports concurrent execute (Node/static child-process backends) — `resolveRenderConcurrency` forces `1` (serial) on every other adapter (WASM, on-device). Default width is `3`, capped by the segment count; set to `1` to force the serial path everywhere.

## Descriptor-side knobs

Two `global` fields on the template descriptor resolve onto `ProjectConfig.videoConfig` at construct time (see above):

| Field                | Type                                    | Effect                                                                                                               |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `global.orientation` | `'landscape' \| 'portrait' \| 'square'` | Resolves the output scale (landscape `1280:720` / portrait `720:1280` / square `1080:1080`).                         |
| `global.fps`         | `number`                                | Output frame rate for every re-encode pass (segments + final assembly); wins over a host-supplied `videoConfig.fps`. |

## Environment variables

Read via `process.env`; every one is an opt-in toggle or a bench/debug escape hatch — none is required, and defaults preserve existing behaviour.

| Variable                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                          | Default                                  | Read at                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `FVC_HWENCODE`                 | Opt-in auto-select of a hardware H.264 encoder (`h264_videotoolbox` / `h264_mediacodec`) when no explicit `codecConfig.videoCodec` is set. Off by default — benchmarks showed it's slower than libx264 `ultrafast` on short multi-segment renders and only marginally faster on heavy single encodes (see `docs/perf-findings.md`). **Node `compile()` path only** — never touches the browser or React Native paths. | unset (off)                              | `index.ts` — `autoSelectHardwareEncoder`                                                            |
| `FVC_DISABLE_FUSION`           | Forces the two-pass overlay path (a separate xfade assembly, then a standalone overlay pass) instead of fusing whole-video `global.animations` into the xfade re-encode. Bench/debug A/B escape hatch.                                                                                                                                                                                                                | unset (fusion on)                        | `editor/VideoEditor.ts` — `stageOverlaysForFusion` / `overlayAnimations`                            |
| `FVC_DISABLE_CONCAT_FOLD`      | Forces the standard two-pass finalize (a separate concat-copy pass, then the music/normalize pass) instead of folding the concat-copy into the following audio pass. Bench/debug escape hatch.                                                                                                                                                                                                                        | unset (fold on)                          | `director/TemplateDirector.ts`, consumed by `director/finalize-concat-fold.ts` — `shouldFoldConcat` |
| `FVC_PERF`                     | Enables the process-wide perf timer (spans for director/segment/ffmpeg/editor stages). Any truthy value except `'0'` turns it on; absent when `process` doesn't exist (browser).                                                                                                                                                                                                                                      | unset (disabled)                         | `utils/perf-timer.ts` — `createPerfTimer`                                                           |
| `FVC_PERF_OUT`                 | Pins an exact file path for the per-run perf-report JSON — lets a bench harness avoid path collisions across fixtures that share `meta.name`. When unset, the report is written to `${buildDir}/perf-${name}.json`.                                                                                                                                                                                                   | unset (derived path)                     | `index.ts` — `emitPerfReport`                                                                       |
| `FFMPEG_COMPOSER_SKIP_WELCOME` | Suppresses the CLI's startup banner. The banner is already skipped in CI or a non-TTY terminal regardless of this flag.                                                                                                                                                                                                                                                                                               | unset (banner shown when TTY and not CI) | `main.ts` — `shouldShowWelcome`                                                                     |

## Encoder selection & tiers

**Selection order:**

1. Explicit `codecConfig.videoCodec` — always wins, whatever else is set.
2. `FVC_HWENCODE=1` (Node only) — probes the ffmpeg build's available encoders and auto-selects a platform hardware encoder if one is exposed.
3. `h264` — the default when neither above applies (the default `ProjectConfig` sets `videoCodec` to `''`, and any falsy value falls through to `h264`).

**Tier tables** — `resolveTier` reads `qualityTier` (falling back to `'standard'` for anything unrecognised), then `buildVideoEncoderArgs` picks the table for the resolved codec family:

| Codec family                                         | Args shape                                                              | draft                | standard            | high              |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | -------------------- | ------------------- | ----------------- |
| Software (`h264`/libx264-style — server/web default) | `-crf … -tune film -b:v … -profile:v high -preset …`                    | crf 30, veryfast, 6M | crf 23, medium, 12M | crf 18, slow, 16M |
| Hardware (`*_mediacodec` / `*_videotoolbox`)         | `-c:v … -b:v …` (no libx264-only flags)                                 | 4M                   | 8M                  | 12M               |
| `libopenh264` (on-device LGPL software encoder)      | `-c:v libopenh264 -b:v …` (Constrained Baseline only — no `-profile:v`) | 2M                   | 4M                  | 6M                |
| `mpeg4` (on-device LGPL fallback)                    | `-c:v mpeg4 -q:v …` (qscale — lower is better)                          | 8                    | 4                   | 2                 |

`hardwareConfig.preset` overrides the software tier's default preset when set.

The **browser WASM** re-encode path is a fixed `-c:v libx264 … -preset ultrafast`, taking only `crf` from the resolved software tier — `preset` stays `ultrafast` regardless of tier (a WASM in-memory-filesystem speed constraint, not a quality knob).
