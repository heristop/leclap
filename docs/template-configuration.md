# 🧩 Template Configuration

A **template** is a JSON document that describes a video: its global settings and the ordered sections that make it up. The compiler (`ffmpeg-video-composer`) turns a template plus a `ProjectConfig` (build/assets dirs, locale, user-supplied form values, recorded clips) into a finished video. The same descriptor renders on Node, in the browser via WebAssembly, and fully on-device on React Native.

This is the template descriptor reference. Upgrading an older template? See [Migrating older templates](#migrating-older-templates).

- **Source of truth (zod):** [`packages/ffmpeg-video-composer/src/schemas/`](../packages/ffmpeg-video-composer/src/schemas/) — every field carries a `.describe()`. `TemplateDescriptorSchema` is the root.
- **Machine-readable schema:** [`docs/template-descriptor.schema.json`](./template-descriptor.schema.json) — generated from the zod source via `pnpm --filter ffmpeg-video-composer generate:schema`. Feed this to an editor or an agent for autocompletion/validation.
- **Examples:** [`packages/creative-kit/src/templates/`](../packages/creative-kit/src/templates/) — shared template descriptors plus bundled creative assets.
- **Validation:** `TemplateValidator` validates a descriptor against the schema (plus cross-field rules) before compilation.

> For the conceptual compile pipeline (director → builder → segments → managers), see [`architecture.md`](./architecture.md).

## Philosophy: structured sugar vs. raw filters

A descriptor has two layers, and you can mix them freely:

- **Structured sugar** — the editor-friendly, LLM-clear layer. `transition`, `look`, `grade`, `motion`, `audio`, `layers`, and animation `inputs` are high-level intents. They compile down to ordinary FFmpeg filters for you (`xfade`/`acrossfade`, `eq`/`colorbalance`/`curves`, `zoompan`/`rotate`/`crop`/`hflip`/`vflip`, `loudnorm`/`sidechaincompress`/`afade`, `drawbox`/gradients). Prefer this layer — it is portable, validated, and on-device-safe.
- **Raw filters (escape hatch)** — `filters[]`, `inputs[].filters`, and `maps[]` pass FFmpeg filter names and arguments through **verbatim**. This is the power-user layer for anything the sugar doesn't cover.

Because `filters[]` is a raw pass-through, its `values` keys stay **FFmpeg-native by design** — `x`, `y`, `w`, `h`, `c`, `t`, `fontcolor`, `fontsize`, `fontfile`, `alpha`, `d`, `st`, `color`, `box`, `boxcolor`, `boxborderw`. They are _not_ camelCased. The structured-sugar fields, in contrast, use editor-friendly camelCase names (`sourceVolume`, `musicVolume`, `colorBalance`, `curvesPreset`). Keep the two mental models separate: sugar = friendly keys, raw filters = FFmpeg keys.

## Top-level shape

```jsonc
{
  "meta": {
    /* Optional display metadata */
  },
  "global": {
    /* GlobalConfig — project-wide defaults */
  },
  "sections": [
    /* ordered Section[] — each becomes a clip, composed in order */
  ],
}
```

All top-level keys are optional (so partial descriptors can be validated incrementally), but a useful template has at least one section.

**All durations are in SECONDS, everywhere** — `options.duration`, `transition.duration`, `audioFade.in.duration`, `countdownDuration`, etc.

## `meta`

Optional human-facing metadata embedded in the descriptor, used by template browsers and agent catalogs.

| Field         | Type     | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `name`        | `string` | Human-readable template name.                   |
| `description` | `string` | Short template summary for catalogs and agents. |

## `global`

Project-wide defaults and the options a builder/editor exposes to end users. `global` is `strict` — unknown keys are rejected.

| Field                   | Type                                 | Description                                                                     |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `variables`             | `Record<string, string \| string[]>` | Named values referenced anywhere via `{{ varName }}`.                           |
| `orientation`           | `'landscape' \| 'portrait'`          | Output orientation → resolution preset (default `landscape`).                   |
| `colorsList`            | `string[]`                           | Palette offered to the user; reference as `{{ color1 }}`, `{{ color2 }}`.       |
| `musicEnabled`          | `boolean`                            | Whether background music is enabled (default `true`).                           |
| `music`                 | `{ name: string, url?: string }`     | Default background track. Omit `url` to use an app-managed track.               |
| `transition`            | `Transition`                         | Default boundary transition between sections (see [Transitions](#transitions)). |
| `audio`                 | `GlobalAudio`                        | Global audio mix (see [Audio](#audio)).                                         |
| `allowedMusic`          | `string[]`                           | Allowlist of music identifiers the user may choose.                             |
| `allowUploadMusic`      | `boolean`                            | Allow the user to upload a custom music file (default `false`).                 |
| `allowedBackgrounds`    | `string[]`                           | Allowlist of background identifiers the user may choose.                        |
| `allowUploadBackground` | `boolean`                            | Allow the user to upload a custom background (default `false`).                 |

## Sections

`sections` is a discriminated union on `type`. Every section shares the **base fields** below, then adds type-specific `options`.

### Section types

| `type`             | Renders                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `video`            | A pre-recorded / asset-backed clip (`options.videoUrl`).                    |
| `project_video`    | A clip captured from the device camera (supports a `framingGuide`).         |
| `form`             | A text-input form (`options.fields`); collects values for `{{ field }}`.    |
| `color_background` | A solid or layered colour background (`options.backgroundColor`, `layers`). |
| `image_background` | A still image background (`options.pictureUrl`).                            |
| `music`            | An audio-only / timeline-padding section (no video).                        |

Renderable visual segments live in `packages/ffmpeg-video-composer/src/editor/segments/`; `SegmentFactory` maps `type` → class.

### Base fields (all sections)

| Field         | Type             | Description                                                                               |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `name`        | `string`         | Unique id within the template; used in section references.                                |
| `type`        | section literal  | One of the types above (discriminates the union).                                         |
| `title`       | `Translation`    | Localised title shown to the user (e.g. `{ "en": "…" }`).                                 |
| `description` | `Translation`    | Localised instruction text shown to the user.                                             |
| `options`     | type-specific    | See [Options](#options).                                                                  |
| `inputs`      | `Input[]`        | Animation inputs composited over the section (see [Animation inputs](#animation-inputs)). |
| `maps`        | `Map[]`          | Custom filtergraph maps (see [Maps](#maps)).                                              |
| `filters`     | `Filter[]`       | Raw FFmpeg filter chain on the section output (see [Filters](#filters)).                  |
| `transition`  | `Transition`     | Boundary transition applied **after** this section; overrides `global.transition`.        |
| `look`        | look preset      | Named colour-grade (see [Looks & grade](#looks--grade)).                                  |
| `grade`       | `Grade`          | Fine-grained colour-grade (see [Looks & grade](#looks--grade)).                           |
| `motion`      | `MotionEffect[]` | Ordered motion / geometric effects (see [Motion](#motion)).                               |

### Options

Common options (`BaseSectionOptionsSchema`, `strict`) shared by all sections, plus per-type extras. **All durations are in seconds.**

| Field                                      | Type                | Description                                                                            |
| ------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------- |
| `duration`                                 | `number` (s)        | Fixed section duration in **seconds**; overrides clip length.                          |
| `musicVolume`                              | `number` 0..1       | Per-section music volume override (overrides `global.audio.musicVolume`).              |
| `audioFade`                                | `{ in?, out? }`     | Section audio fades (see [Audio](#audio)).                                             |
| `speed`                                    | `number` > 0        | Playback speed multiplier (default 1). Audio uses `atemp`, clamped to `[0.5, 2]`.      |
| `muteSection`                              | `boolean`           | Silence the source audio of this section (default `false`).                            |
| `countdown`                                | `boolean`           | Show a countdown overlay before recording (default `false`).                           |
| `countdownDuration`                        | `number` (s)        | Countdown length in seconds (default 3); only when `countdown`.                        |
| `upperCase` / `lowerCase`                  | `boolean`           | Force all text in the section to upper/lower case.                                     |
| `useVideoSection`                          | `string`            | Reuse another `project_video` section's recorded clip by name.                         |
| `videoUrl`                                 | `string`            | Pre-recorded video asset (`video` section).                                            |
| `logoUrl` / `backgroundUrl` / `pictureUrl` | `string`            | Asset URLs composited into the section.                                                |
| `backgroundColor`                          | `string`            | Solid background colour as a CSS hex (e.g. `#000000`).                                 |
| `forceAspectRatio`                         | `boolean`           | Crop the clip to the output aspect ratio (default `false`).                            |
| `forceOriginalAspectRatio`                 | `boolean`           | Letterbox to preserve the clip's original aspect ratio (default `false`).              |
| `layers`                                   | `BackgroundLayer[]` | **`color_background` only** — composited layers (see [Layers](#layers)).               |
| `framingGuide`                             | `FramingGuide`      | **`project_video` only** — recording-UI overlay (see [Framing guide](#framing-guide)). |

`form` sections use `options.fields`: `{ name, maxLength, label: Translation }[]`. Each field's `name` becomes a `{{ name }}` variable usable in any filter.

## Transitions

A `Transition` controls the boundary **after** a section:

```jsonc
{ "type": "fade", "duration": 0.4 } // xfade name, or "cut" for a hard cut
```

- `type` — one of the [xfade names](#xfade-transition-names) below, or `"cut"`.
- `duration` — optional, in seconds (max 5). **Effective duration = `section.transition.duration` ?? `global.transition.duration` ?? `0.3`** (`DEFAULT_TRANSITION_DURATION`).

**How it compiles & performs:**

- A template whose boundaries are **all `cut`** (or have no transition) uses a fast stream-copy `concat` — cheap.
- **Any non-`cut` boundary forces a single re-encode assembly pass**: the segments are stitched with `xfade` (video) / `acrossfade` (audio), with offsets computed from the **probed** segment durations.
- ⚠️ **Performance:** that re-encode runs over the **full timeline** and is costly on WASM (the ~2 GB IndexedDB filesystem limit) and on-device. Cuts are nearly free. Prefer cuts unless a soft transition meaningfully improves the result.

The validator rejects:

- a non-`cut` transition on the **last** rendering section (nothing to transition into — `dangling_transition`);
- an effective transition duration **≥** the smaller of the two adjacent _declared_ `options.duration`s (`transition_too_long`);
- `kenburns` motion on any section other than `image_background` (`motion_unsupported_section`).

### xfade transition names

Quoted from `XFADE_TRANSITIONS` in [`effects.schemas.ts`](../packages/ffmpeg-video-composer/src/schemas/effects.schemas.ts) — that array is the authoritative list (don't retype it):

`fade`, `fadeblack`, `fadewhite`, `fadegrays`, `distance`, `dissolve`, `pixelize`, `radial`, `hblur`, `wipeleft`, `wiperight`, `wipeup`, `wipedown`, `wipetl`, `wipetr`, `wipebl`, `wipebr`, `slideleft`, `slideright`, `slideup`, `slidedown`, `smoothleft`, `smoothright`, `smoothup`, `smoothdown`, `circlecrop`, `rectcrop`, `circleclose`, `circleopen`, `horzclose`, `horzopen`, `vertclose`, `vertopen`, `diagbl`, `diagbr`, `diagtl`, `diagtr`, `hlslice`, `hrslice`, `vuslice`, `vdslice`, `hlwind`, `hrwind`, `vuwind`, `vdwind`, `coverleft`, `coverright`, `coverup`, `coverdown`, `revealleft`, `revealright`, `revealup`, `revealdown`, `squeezeh`, `squeezev`, `zoomin` — plus the special value `cut`.

## Looks & grade

`look` is a one-word colour-grade preset: `cinematic`, `warm`, `cool`, `vintage`, `noir`, `vivid`, `dreamy` (`LOOK_PRESETS`).

`grade` is the fine-grained equivalent and stacks on top of `look`. All fields optional:

| Field                                                | Range           | Default | Compiles to    |
| ---------------------------------------------------- | --------------- | ------- | -------------- |
| `brightness`                                         | -1..1           | 0       | `eq`           |
| `contrast`                                           | 0..2            | 1       | `eq`           |
| `saturation`                                         | 0..3            | 1       | `eq`           |
| `gamma`                                              | 0.1..3          | 1       | `eq`           |
| `hue`                                                | -180..180 (deg) | 0       | `hue`          |
| `colorBalance.{shadows,midtones,highlights}.{r,g,b}` | -1..1           | —       | `colorbalance` |
| `blur`                                               | 0..20 (px)      | 0       | `gblur`        |
| `curvesPreset`                                       | string key      | —       | `curves`       |

Looks and grades compile to ordinary FFmpeg filters (`eq`, `colorbalance`, `curves`, `gblur`, `hue`) — nothing exotic, on-device-safe.

## Motion

`motion` is an **ordered array** of geometric effects applied to the section video; they compile to `zoompan` / `rotate` / `crop` / `hflip` / `vflip`:

```jsonc
[
  { "type": "kenburns", "direction": "in", "intensity": 1.2 }, // image_background only
  { "type": "rotate", "angle": 5 },
  { "type": "crop", "w": 1280, "h": 720, "x": 0, "y": 0 },
  { "type": "flip", "axis": "horizontal" },
]
```

| `type`     | Fields                                                                                     | Notes                                              |
| ---------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `kenburns` | `direction?` (`in`/`out`/`left`/`right`/`up`/`down`), `intensity?` (1.01..2, default 1.15) | `zoompan` on stills — **`image_background` only**. |
| `rotate`   | `angle` (degrees, + = clockwise)                                                           | `rotate`.                                          |
| `crop`     | `w`, `h` (required), `x?`, `y?` (px or FFmpeg expression)                                  | `crop`; default offset centres the crop.           |
| `flip`     | `axis` (`horizontal` / `vertical`)                                                         | `hflip` / `vflip`.                                 |

## Audio

`global.audio` (`GlobalAudio`) sets the mix; per-section `options.audioFade` and `options.musicVolume` refine it.

| Field          | Type                           | Compiles to / behaviour                                               |
| -------------- | ------------------------------ | --------------------------------------------------------------------- |
| `sourceVolume` | `number` 0..1 (default 1)      | Recorded/source-audio volume in the final mix.                        |
| `musicVolume`  | `number` 0..1 (default 0.5)    | Background-music volume; per-section `options.musicVolume` overrides. |
| `normalize`    | `'loudnorm'` \| `'dynaudnorm'` | `loudnorm I=-16:TP=-1.5:LRA=11` or single-pass `dynaudnorm`.          |
| `ducking`      | `boolean` \| object            | Music ducking via `sidechaincompress` when source audio is present.   |

`ducking` as an object: `{ threshold? (0..1, default 0.05), ratio? (1..20, default 8), attack? (ms, default 20), release? (ms, default 400) }`.

**Section audio fades** — `options.audioFade`: `{ in?: { duration, curve? }, out?: { duration, curve? } }`, compiled to `afade`. `duration` is in seconds; `curve` is an FFmpeg afade curve (`tri` default).

> `speed` ≠ 1 retimes audio via `atemp`, which is **clamped to `[0.5, 2]`**. Outside that range, video and audio can desync — split into multiple `atemp` stages or avoid extreme speeds.

## Layers

`color_background` sections can stack composited `layers` on top of the base colour (drawn as boxes / gradients). Ordered; each:

```jsonc
{
  "color": "#0d1b2a", // solid fill (CSS hex / FFmpeg colour name)
  "opacity": 0.8, // 0..1, default 1
  "x": 0,
  "y": 0, // offset (px or FFmpeg expr), default 0
  "w": 1280,
  "h": 150, // size (px or FFmpeg expr), default full output
  "gradient": {
    // optional; overrides `color`
    "from": "#13243f",
    "to": "#0d1b2a",
    "direction": "vertical", // horizontal | vertical | diagonal (default vertical)
  },
}
```

## Framing guide

`project_video` sections may declare `options.framingGuide` — a **recording-UI overlay only**. It guides the user while filming and is **never rendered into the output video**:

```jsonc
{ "type": "silhouette", "position": "center", "opacity": 0.5 }
```

`type` is always `silhouette`; `position` is `left` | `center` | `right`; `opacity` 0..1 (default 0.5).

## Animation inputs

`inputs[]` composites animated overlays on top of a section. An animation is **one** input — either an `image2` PNG sequence (a ZIP of frames) **or** a single animated file (`.apng` / `.webp` / `.gif` / `.webm`):

```jsonc
{
  "name": "confetti",
  "url": "{{ confettiZip }}",
  "type": "animation",
  "options": {
    "fps": 25, // sequence playback rate (default 25)
    "position": "0:0", // overlay "x:y" in output px
    "scale": "640:-1", // pre-composite scale "w:h"
    "loop": true, // → stream_loop (loops for the section)
    "persistent": true, // → eof_action=repeat (holds last frame past EOF)
  },
  "filters": [
    /* optional raw chain on this input before compositing */
  ],
}
```

`loop` maps to `stream_loop`; `persistent` maps to `eof_action=repeat`. Reference an input by `@name` from a `maps[]` entry.

> The old `frames` / `frequency` / `overlay` options and `type: "frame"` are **removed** — see [Migrating older templates](#migrating-older-templates).

## Maps

`maps[]` wires the FFmpeg filtergraph explicitly — only needed for multi-input / overlay sections beyond what the sugar covers.

| Field     | Type                              | Description                                                                                 |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `inputs`  | `string[]`                        | Ordered input stream labels feeding this graph. `@name` resolves to an input/animation pad. |
| `outputs` | `string[]`                        | Ordered output labels; the **final** map's last output **must end with `final`**.           |
| `filters` | `Filter[]`                        | Filter chain between inputs and outputs.                                                    |
| `options` | `{ useSectionFilters?: boolean }` | When true, the section-level `filters` run inside this map's chain.                         |

## Filters

`filters[]` is the **raw FFmpeg escape hatch** — each entry is passed through verbatim:

| Field    | Type               | Description                                                                                           |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `type`   | `string`           | Raw FFmpeg filter name (`drawtext`, `drawbox`, `fade`, `vignette`, `boxblur`, `overlay`, `scale`, …). |
| `value`  | `string \| number` | Single scalar arg for simple filters.                                                                 |
| `values` | `FilterValues`     | Structured args — **FFmpeg-native keys** (see below).                                                 |
| `range`  | `string`           | Active window as `"start:end"` in seconds.                                                            |

`values` keys (kept FFmpeg-native **by design**): `x`, `y`, `w`, `h`, `c`, `t`, `text` (a `Translation`), `fontcolor`, `fontsize`, `fontfile`, `alpha`, `d`, `st`, `color`, `box`, `boxcolor`, `boxborderw`.

`text`, `title`, `description`, and form-field `label` are `Translation` objects (`{ "en": "…", "fr": "…" }`) for i18n.

## Variables & placeholders

- **`global.variables`** — `string` or `string[]`; reference anywhere with `{{ name }}`. Resolved by `VariableManager`.
- **`{{ colorN }}`** — 1-indexed into `global.colorsList`.
- **`{{ form_field }}`** — a `form` section's field `name`, filled at compose time.

---

## Example: simple (cuts, music)

A minimal, complete, valid descriptor — two clips joined by hard cuts with a background track.

```json
{
  "global": {
    "orientation": "landscape",
    "musicEnabled": true,
    "music": { "name": "air-prelude.mp3" },
    "audio": { "sourceVolume": 1, "musicVolume": 0.5 }
  },
  "sections": [
    {
      "name": "intro",
      "type": "color_background",
      "transition": { "type": "cut" },
      "options": { "backgroundColor": "#0d1b2a", "duration": 2 },
      "filters": [
        {
          "type": "drawtext",
          "values": {
            "text": { "en": "My Story" },
            "fontcolor": "#ffffff",
            "fontsize": 96,
            "x": "(w-text_w)/2",
            "y": "(h-text_h)/2",
            "fontfile": "BebasNeue.ttf"
          }
        }
      ]
    },
    {
      "name": "clip",
      "type": "video",
      "options": { "videoUrl": "{{ clip }}", "duration": 6 },
      "filters": [
        { "type": "fadein", "values": { "color": "#0d1b2a" } },
        { "type": "fadeout", "values": { "color": "#0d1b2a" } }
      ]
    }
  ]
}
```

(Declare `clip` in `global.variables`, or pass it at compose time.)

## Example: rich (transition + look + motion + audio + layers)

A complete, valid descriptor exercising the structured-sugar layer: a layered title card that wipes into a Ken-Burns still and a graded camera clip, with ducked, normalised audio.

```json
{
  "global": {
    "orientation": "landscape",
    "musicEnabled": true,
    "music": { "name": "air-prelude.mp3" },
    "transition": { "type": "fade", "duration": 0.4 },
    "audio": {
      "sourceVolume": 1,
      "musicVolume": 0.5,
      "normalize": "loudnorm",
      "ducking": { "threshold": 0.05, "ratio": 8 }
    }
  },
  "sections": [
    {
      "name": "title",
      "type": "color_background",
      "title": { "en": "Title card" },
      "transition": { "type": "wipeleft", "duration": 0.4 },
      "options": {
        "backgroundColor": "#0d1b2a",
        "duration": 2.4,
        "audioFade": { "in": { "duration": 0.6, "curve": "qsin" } },
        "layers": [
          { "color": "#13243f", "opacity": 1, "x": 0, "y": 0, "w": 1280, "h": 150 },
          {
            "x": 0,
            "y": 570,
            "w": 1280,
            "h": 150,
            "gradient": { "from": "#13243f", "to": "#0d1b2a", "direction": "vertical" }
          }
        ]
      },
      "filters": [
        {
          "type": "drawtext",
          "values": {
            "text": { "en": "PRESENTING" },
            "fontcolor": "#e8eef7",
            "fontsize": 30,
            "x": "(w-text_w)/2",
            "y": 250,
            "fontfile": "Oswald.ttf"
          }
        }
      ]
    },
    {
      "name": "still",
      "type": "image_background",
      "transition": { "type": "fade", "duration": 0.4 },
      "options": { "pictureUrl": "{{ photo }}", "duration": 3 },
      "look": "cinematic",
      "grade": { "contrast": 1.1, "saturation": 1.2 },
      "motion": [{ "type": "kenburns", "direction": "in", "intensity": 1.2 }]
    },
    {
      "name": "clip",
      "type": "project_video",
      "title": { "en": "Record your clip" },
      "options": {
        "duration": 30,
        "forceAspectRatio": true,
        "framingGuide": { "type": "silhouette", "position": "center", "opacity": 0.5 }
      },
      "look": "warm",
      "grade": {
        "brightness": 0.02,
        "saturation": 1.15,
        "colorBalance": { "highlights": { "r": 0.05, "b": -0.05 } }
      },
      "filters": [{ "type": "vignette" }]
    }
  ]
}
```

> Note: no transition is declared on the **last** rendering section (`clip`) — a non-`cut` one there would be rejected (`dangling_transition`). Each declared transition duration (0.4 s) is shorter than the smaller adjacent `duration`, satisfying `transition_too_long`. `kenburns` sits on an `image_background`, satisfying `motion_unsupported_section`.

## Validating

Run a descriptor through `TemplateValidator` (zod + the cross-field rules above). On failure, zod reports the exact path/field — fix the JSON to match the schema. After editing any `.json`, run `pnpm fmt`. To regenerate the machine-readable schema after a zod change: `pnpm --filter ffmpeg-video-composer generate:schema`.

## Migrating older templates

| Old field                                   | Replacement                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `global.audioVolumeLevel`                   | `global.audio.sourceVolume`                                                      |
| `global.transitionDuration`                 | `global.transition.duration` (with `transition.type`)                            |
| `options.musicVolumeLevel`                  | `options.musicVolume`                                                            |
| `inputs[].frames` / `frequency` / `overlay` | removed — use a single `animation` input (ZIP or `.apng`/`.webp`/`.gif`/`.webm`) |
| `inputs[].type: "frame"`                    | removed — use `type: "animation"`                                                |

Other breaking changes:

- **Durations are now seconds everywhere.** Previously, `project_video` `options.duration` was in **milliseconds**; now it is **seconds** (e.g. `30000` → `30`). All other durations were already seconds.
- Transitions are now structured: a bare `transitionDuration` becomes a `transition` object (`{ type, duration }`) on `global` and/or per section. A template that relied on an implicit cross-fade should set `global.transition` explicitly, or `{ "type": "cut" }` for hard cuts.
- The structured-sugar layer (`look`, `grade`, `motion`, `audio`, `layers`, `framingGuide`) is new — older templates remain valid without it.
