# Upgrading from v1 to v2

The npm package name is **unchanged** — you still install `ffmpeg-video-composer`.
The `le-clap` → `leclap` rename in this release was internal to the monorepo
(directories and `@leclap/*` workspace scopes) and is **invisible to consumers**
of the published package. The `compile` / `loadConfig` API is the same.

## TL;DR

- **API is unchanged** — `compile(projectConfig, template)` and `loadConfig(path)`
  keep the same signatures.
- **Node `>=24.11.0`** is now required (was `>=22.14.0`).
- **New entry points** — `/browser` and `/reactnative` exports (the CLI now lives in `@leclap/cli`).
- **The template descriptor grew a lot** — colour grading, motion, captions,
  per-section transitions, partials, background layers, and an audio mix block.
  All of it is **additive**: existing templates keep working.
- **Six fields were renamed.** A v1 template still compiles (compile does not
  validate), but the old names are now **silently ignored** — so the affected
  settings quietly fall back to defaults. Rename them, or validate with the new
  `TemplateDescriptorSchema` to catch them (see [Template descriptor](#template-descriptor)).

## Node version

`engines.node` now requires **Node `>=24.11.0`** (v1 required `>=22.14.0`).
Upgrade your runtime; the package will refuse to install on older Node.

## Package layout / entry points

| Concern       | v1               | v2                                                 |
| ------------- | ---------------- | -------------------------------------------------- |
| CLI binary    | (none published) | moved to the `@leclap/cli` package (`leclap` bin)  |
| Browser entry | (none)           | `ffmpeg-video-composer/browser`                    |
| RN entry      | (none)           | `ffmpeg-video-composer/reactnative`                |
| `compile.js`  | shipped script   | removed — use `@leclap/cli`                        |
| `diagnose.js` | shipped script   | removed — use `@leclap/cli --diagnose`             |
| `./src/index` | available        | dropped (`.`, `./browser`, `./reactnative` remain) |

The default `.` import is unchanged:

```js
import { compile, loadConfig } from 'ffmpeg-video-composer';
```

## Template descriptor

The `{ global, sections }` shape is the same, and **`compile()` does not validate**
— it just reads the fields it knows. That has one consequence worth underlining:
a v1 template **will not throw**, but anywhere a field was renamed, v2 reads the
new name, misses the old one, and uses the **default**. Symptoms are silent:
music at `0.5` instead of your level, the wrong animation cadence, no transition.

### Renamed fields — do these or the setting is dropped

| v1                                 | v2                            | Notes                                                                                                                  |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `global.audioVolumeLevel`          | `global.audio.sourceVolume`   | Moved into the new `audio` block (alongside `musicVolume`, `normalize`, `ducking`).                                    |
| `global.transitionDuration`        | `global.transition.duration`  | Now an object — add a `type` (e.g. `{ type: 'dissolve', duration: 0.5 }`). Also unlocks per-section video transitions. |
| `section.options.musicVolumeLevel` | `section.options.musicVolume` | Same `0..1` range, new key.                                                                                            |
| `input.type: "frame"`              | `input.type: "animation"`     | Frame-sequence / animated overlays.                                                                                    |
| `input.options.frequency`          | `input.options.fps`           | **Reciprocal, not a copy:** `fps = 1 / frequency`. `0.04 → 25`, `0.3 → 3.333`.                                         |
| `input.options.overlay`            | `input.options.position`      | Same `"x:y"` string, new key.                                                                                          |

> `options.duration` is **seconds in both versions** (it maps straight to ffmpeg
> `-t`). If a v1 template used an oversized cap like `20000` on a `project_video`,
> that still works (the clip trims to its real length) — it is **not** milliseconds
> and needs no change. Tidy it to a real bound (e.g. `20`) if you like.

Let the schema find them for you — the new strict schema **rejects** every legacy
key above, so a `safeParse` is a fast migration checklist:

```js
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';

const result = TemplateDescriptorSchema.safeParse(json);
if (!result.success) {
  // e.g. "Unrecognized key: musicVolumeLevel", "frequency", "audioVolumeLevel" …
  console.error(result.error.issues);
}
```

### New, optional capabilities

None of these are required — adopt them per section when you want the effect.

- **Look & grade** — `section.look` (`cinematic` · `warm` · `cool` · `vintage` ·
  `noir` · `vivid` · `dreamy`) and `section.grade`
  (`brightness`, `contrast`, `saturation`, `gamma`, `hue`, `colorBalance`, `blur`,
  `curvesPreset`).
- **Motion** — `section.motion: [{ type: 'kenburns' | 'rotate' | 'crop' | 'flip', … }]`
  (e.g. a Ken Burns push-in: `{ type: 'kenburns', direction: 'in', intensity: 1.1 }`).
- **Captions** — `section.caption: { text, style, position, align, … }` — styled
  lower-thirds without hand-writing `drawtext`.
- **Transitions** — `section.transition` / `global.transition`
  (`{ type, duration }`) drive real xfade transitions between sections; any
  `XFADE_TRANSITIONS` name, or `"cut"` for a hard cut.
- **Partials** — a new section type: `{ type: 'partial', ref: '<id>', variables: { … } }`
  expands a reusable fragment (with `{{ key }}` substitution) before compilation.
- **Background layers** — `color_background` sections take `options.layers: [{ color | gradient, opacity, x, y, w, h }]`.
- **Audio mix** — `global.audio: { sourceVolume, musicVolume, normalize, ducking }`,
  plus per-section `options.audioFade: { in, out }`.
- **Selection allowlists** — `global.allowedMusic`, `allowUploadMusic`,
  `allowedBackgrounds`, `allowUploadBackground` (for editor/agent surfaces).
- **Metadata** — optional `meta: { name, description }` at the root.

New exports back all of this: `TemplateDescriptorSchema`,
`templateDescriptorJsonSchema`, the `LOOK_PRESETS` / `XFADE_TRANSITIONS` /
`AFADE_CURVES` constants, and the `Transition` / `Grade` / `MotionEffect` /
`BackgroundLayer` types.

### Before / after

A `project_video` section, v1 → v2 (renames applied, new sugar added):

```jsonc
// v1
{
  "name": "video_1",
  "type": "project_video",
  "options": { "duration": 20000, "musicVolumeLevel": 0.1 },
  "inputs": [
    {
      "name": "animatedIcon",
      "type": "frame",
      "options": { "frequency": 0.3, "overlay": "600:200", "scale": "1280:720", "persistent": false }
    }
  ]
}

// v2
{
  "name": "video_1",
  "type": "project_video",
  "look": "warm",                                                   // new
  "grade": { "contrast": 1.1, "saturation": 1.2, "gamma": 0.96 },   // new
  "motion": [{ "type": "kenburns", "direction": "in", "intensity": 1.1 }], // new
  "transition": { "type": "pixelize", "duration": 0.4 },            // new
  "options": { "duration": 20, "musicVolume": 0.1 },                // musicVolumeLevel → musicVolume
  "inputs": [
    {
      "name": "animatedIcon",
      "type": "animation",                                          // frame → animation
      "options": { "fps": 3.333, "position": "600:200", "scale": "1280:720", "persistent": false }
      //            frequency 0.3 → fps 3.333 (1/0.3)   overlay → position
    }
  ]
}
```

## Security / behavior changes

These tighten how untrusted or edge-case templates are handled. If you feed
hand-crafted or user-supplied templates, review these:

- **No shell.** FFmpeg is now invoked via `execFile` instead of a shell, so
  shell metacharacters in template values are no longer interpreted.
- **argv tokens reject whitespace.** Template string values interpolated as
  unquoted ffmpeg argv tokens (e.g. a section `color`, an input `url`, a section
  name) now reject embedded whitespace and NUL bytes. A template whose `color`
  is `"red 0.5"` (raw space) now **throws** instead of silently injecting extra
  ffmpeg arguments. Use a valid single-token value (`red@0.5`); real URLs should
  percent-encode spaces.
- **SSRF guard on remote fetches (server-side).** When the Node runtime fetches
  a remote `videoUrl` / `music.url` / background URL, it now refuses:
  - non-`http(s)` schemes (e.g. `file:`, `gopher:`),
  - private / reserved / loopback / link-local addresses, including the cloud
    metadata address `169.254.169.254` and `localhost`,
  - hostnames that resolve to any of the above — re-checked across HTTP redirects.

  Templates that legitimately reference public `http(s)` media are unaffected.

## Still the same

- The `compile(projectConfig, template)` / `loadConfig(path)` API is unchanged,
  and compile still consumes the descriptor without requiring schema validation.
- The `{ global, sections }` document shape, `{{ variable }}` interpolation, and
  authored `filters` / `maps` are unchanged.
- FFmpeg detection order (system → `ffmpeg-static` → WASM) is unchanged.
- `drawtext`-capable FFmpeg is still required for text / background-color
  segments.
