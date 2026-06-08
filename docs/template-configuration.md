# 🧩 Template Configuration (JSON)

A **template** is a JSON document that describes a video: its global settings, the ordered sections that make it up, and — for each section — the FFmpeg input/map/filter pipeline that renders it. The compiler (`ffmpeg-video-composer`) turns a template plus a `ProjectConfig` (build/assets dirs, locale, and user-supplied form field values) into a finished video.

- **Source of truth:** the Zod schema at [`packages/ffmpeg-video-composer/src/schemas/template.schemas.ts`](../packages/ffmpeg-video-composer/src/schemas/template.schemas.ts) (`TemplateDescriptorSchema`).
- **Examples:** [`packages/ffmpeg-video-composer/src/shared/templates/`](../packages/ffmpeg-video-composer/src/shared/templates/) — start with `concat_videos_with_music.json` (simple) or `sample.json` (full).
- **Validation:** `TemplateValidator` validates a descriptor against the schema before compilation.

> For the conceptual compile pipeline (director → builder → segments → managers), see [`architecture.md`](./architecture.md).

## Top-level shape

```jsonc
{
  "global": {
    /* GlobalConfig — defaults & builder options */
  },
  "sections": [
    /* ordered Section[] — each becomes a clip, concatenated in order */
  ],
}
```

Both keys are optional, but a useful template has at least one section. Sections are rendered independently and concatenated in array order, with audio mixed across the whole timeline.

## `global`

Project-wide defaults and the options a builder/editor exposes to end users.

| Field                   | Type                                 | Description                                                                                                             |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `variables`             | `Record<string, string \| string[]>` | Named values referenced as `{{ name }}` placeholders. Arrays are joined with `, `. Also holds `colorsList` (see below). |
| `orientation`           | `'landscape' \| 'portrait'`          | Output orientation.                                                                                                     |
| `colorsList`            | `string[]`                           | Theme colors, referenced as `{{ color1 }}`, `{{ color2 }}`, … (1-indexed). Usually nested under `variables`.            |
| `musicEnabled`          | `boolean`                            | Whether background music is mixed in.                                                                                   |
| `audioVolumeLevel`      | `number` (0–1)                       | Master music volume.                                                                                                    |
| `transitionDuration`    | `number` (> 0)                       | Default crossfade/transition length in seconds; also drives `{{ transitionDuration }}`.                                 |
| `music`                 | `{ name, url? }`                     | Default background track. `url` may be remote or a bundled/local file name.                                             |
| `allowedMusic`          | `string[]`                           | **Builder:** music tracks the end user may pick from.                                                                   |
| `allowUploadMusic`      | `boolean`                            | **Builder:** allow the end user to upload their own music.                                                              |
| `allowedBackgrounds`    | `string[]`                           | **Builder:** backgrounds the end user may pick from.                                                                    |
| `allowUploadBackground` | `boolean`                            | **Builder:** allow the end user to upload their own background.                                                         |

The `allow*` / `allowed*` fields don't affect raw compilation — they tell the editor/app **which choices to present** to the person customizing the template.

## Variables & placeholders

Any string in the template may contain `{{ ... }}` placeholders, resolved at compile time:

| Placeholder                 | Resolves from                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{ name }}`                | `global.variables.name` (a string, or an array joined with `, `).                                                                                             |
| `{{ colorN }}`              | `global.variables.colorsList[N-1]` (1-indexed). `rgb(...)` values are converted to hex.                                                                       |
| `{{ form_field_name }}`     | The user-supplied value for that form field, passed in `ProjectConfig.fields` at compile time (field names come from `form` section `options.fields[].name`). |
| `{{ transitionDuration }}`  | `global.transitionDuration` (in fade filter durations).                                                                                                       |
| `{{ transitionStartTime }}` | Computed by the engine — the section duration minus `transitionDuration` (used for fade-out start times).                                                     |

```jsonc
"variables": {
  "watermark": "https://.../logo.png",
  "colorsList": ["rgb(41 37 36)", "rgb(250 250 249)"]   // -> {{ color1 }}, {{ color2 }}
}
```

## `sections`

Each entry is a discriminated union on `type`. All sections share these base fields:

| Field         | Type             | Description                                                          |
| ------------- | ---------------- | -------------------------------------------------------------------- |
| `name`        | `string`         | Unique section id (referenced by `options.useVideoSection`, etc.).   |
| `type`        | _enum_           | One of the section types below.                                      |
| `title`       | `Translation`    | Localized title (shown by the builder/app, not rendered into video). |
| `description` | `Translation`    | Localized description (builder/app).                                 |
| `inputs`      | `Input[]`        | Extra media fed into this section's FFmpeg graph (see Pipeline).     |
| `maps`        | `Map[]`          | Explicit filtergraph wiring (see Pipeline).                          |
| `filters`     | `Filter[]`       | Filters applied to the section's main stream (see Pipeline).         |
| `options`     | `SectionOptions` | Per-type behavior (see Options).                                     |

### Section types

| `type`             | Renders                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `video`            | A video clip from `options.videoUrl` (or reused via `useVideoSection`).             |
| `project_video`    | A clip from the user's recorded/uploaded project video.                             |
| `form`             | No video — declares `options.fields` the user fills in; values feed `{{ form_* }}`. |
| `color_background` | A solid color clip (`options.backgroundColor`).                                     |
| `image_background` | A still-image clip (`options.pictureUrl`).                                          |
| `music`            | A music-selection section (lets the user pick the track); no rendered frames.       |

### Section `options`

All optional; availability depends on the section type.

| Option                                          | Type           | Description                                                       |
| ----------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `duration`                                      | `number` (> 0) | Clip length in seconds (some templates use ms for project clips). |
| `useVideoSection`                               | `string`       | Reuse another section's video by its `name`.                      |
| `videoUrl`                                      | `string`       | Source video (`video` sections).                                  |
| `pictureUrl`                                    | `string`       | Source image (`image_background`).                                |
| `backgroundColor`                               | `string`       | Fill color (`color_background`).                                  |
| `backgroundUrl` / `logoUrl`                     | `string`       | Background / logo asset.                                          |
| `musicVolumeLevel`                              | `number` (0–1) | Music volume during this section.                                 |
| `muteSection`                                   | `boolean`      | Drop the section's own audio.                                     |
| `speed`                                         | `number` (> 0) | Playback speed factor.                                            |
| `upperCase` / `lowerCase`                       | `boolean`      | Case-transform rendered text.                                     |
| `forceAspectRatio` / `forceOriginalAspectRatio` | `boolean`      | Aspect-ratio handling.                                            |
| `fields`                                        | `Field[]`      | Form inputs (`form` sections — see Fields).                       |

## The section pipeline: inputs → maps → filters

Within a section, FFmpeg work is described by three arrays. A simple section needs only `filters`; complex compositing uses `inputs` + `maps`.

### `inputs` — extra media

| Field     | Type           | Description                                                                 |
| --------- | -------------- | --------------------------------------------------------------------------- |
| `name`    | `string`       | Reference id; used in maps as `@name`.                                      |
| `url`     | `string`       | Source (remote, bundled, or `{{ variable }}`). Optional for derived inputs. |
| `type`    | `string`       | e.g. `frame` for animation frame sequences (zip of frames).                 |
| `options` | `InputOptions` | `frames`, `frequency`, `overlay` (`x:y`), `scale` (`w:h`), `persistent`.    |
| `filters` | `Filter[]`     | Filters applied to this input.                                              |

### `maps` — filtergraph wiring

| Field     | Type                              | Description                                                                                                       |
| --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `inputs`  | `string[]`                        | Sources: `@inputName` (a section input), a prior map's output name, or an FFmpeg stream specifier (`0:0`, `1:v`). |
| `filters` | `Filter[]`                        | Filters applied to this map.                                                                                      |
| `outputs` | `string[]`                        | Named result(s). The `final` output is the section's rendered stream.                                             |
| `options` | `{ useSectionFilters?: boolean }` | When true, the section's top-level `filters` apply to this map.                                                   |

```jsonc
"maps": [
  { "inputs": ["@watermark"], "filters": [{ "type": "scale", "values": { "w": 100, "h": -1 } }], "outputs": ["scaled_logo"] },
  { "inputs": ["@video"], "options": { "useSectionFilters": true }, "outputs": ["video"] },
  { "inputs": ["video", "scaled_logo"], "filters": [{ "type": "overlay", "value": "50:50" }], "outputs": ["final"] }
]
```

### `filters` — FFmpeg filters

| Field    | Type               | Description                                                                                                        |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `type`   | `string`           | FFmpeg filter name: `drawtext`, `drawbox`, `scale`, `overlay`, `fade`, `fadein`, `fadeout`, `boxblur`, `setpts`, … |
| `value`  | `string \| number` | Single inline argument (e.g. `overlay` → `"0:0"`).                                                                 |
| `values` | `FilterValues`     | Structured arguments (below) for filters like `drawtext`/`drawbox`.                                                |
| `range`  | `string`           | Optional time/segment range the filter applies to.                                                                 |

**`FilterValues`** fields: `x`, `y`, `w`, `h` (position/size), `c`/`color`/`fontcolor` (colors), `t` (type/thickness), `text` (a `Translation`), `fontsize`, `fontfile`, `alpha` (expression), `d` (duration), `st` (start time). Colors accept `{{ colorN }}` and an `@alpha` suffix (e.g. `"{{ color1 }}@0.2"`).

```jsonc
{
  "type": "drawtext",
  "values": {
    "text": { "en": "{{ form_1_firstname }} {{ form_1_lastname }}" },
    "fontcolor": "{{ color2 }}",
    "fontsize": 40,
    "x": "(w-text_w)/2",
    "y": "(h-text_h)/1.4",
    "fontfile": "Rubik.ttf",
  },
}
```

## Fields (form sections)

`form` sections declare the inputs the end user fills in. Each value becomes a `{{ form_field_name }}` placeholder available to later sections.

| Field       | Type           | Description                                |
| ----------- | -------------- | ------------------------------------------ |
| `name`      | `string`       | Placeholder key (e.g. `form_1_firstname`). |
| `maxLength` | `number` (> 0) | Max characters.                            |
| `label`     | `Translation`  | Localized field label.                     |

## Translations

`title`, `description`, `label`, and filter `text` are **translation maps** — `Record<locale, string>` — resolved against `ProjectConfig.currentLocale`:

```jsonc
"title": { "en": "A few infos before we start", "fr": "Quelques infos avant de commencer" }
```

## Minimal example

```jsonc
{
  "global": {
    "variables": { "colorTransition": "#000000" },
    "music": { "name": "track.mp3" },
    "orientation": "landscape",
    "musicEnabled": true,
    "transitionDuration": 0.1,
  },
  "sections": [
    {
      "name": "clip_1",
      "type": "video",
      "options": { "videoUrl": "https://.../earth.mp4", "duration": 4, "musicVolumeLevel": 1 },
      "filters": [
        { "type": "fadein", "values": { "color": "{{ colorTransition }}" } },
        { "type": "fadeout", "values": { "color": "{{ colorTransition }}" } },
      ],
    },
  ],
}
```

## Validating a template

```ts
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

const result = TemplateDescriptorSchema.safeParse(json);
if (!result.success) console.error(result.error.issues);
```

Or run it through the compiler — invalid descriptors are rejected by `TemplateValidator` before any FFmpeg work begins.

## Tips

- Keep section `name`s unique and descriptive — they're referenced by `useVideoSection` and aid debugging.
- Prefer `{{ variables }}` and `{{ colorN }}` over hard-coded URLs/colors so a template can be re-themed without editing every filter.
- Build the filtergraph incrementally: a section often needs only `filters`; reach for `inputs` + `maps` only when compositing multiple sources.
- Always end a compositing `maps` chain with an output named `final`.
