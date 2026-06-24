---
name: authoring-video-templates
description: Use when creating or editing a video template JSON (the template descriptor), adding or changing sections/filters/maps/variables/transitions/looks/motion/audio/layers, or debugging template validation errors in ffmpeg-video-composer.
---

# Authoring Video Templates

## Overview

A template is a JSON **descriptor** that the engine compiles into a video. It has two top-level keys: `global` (project-wide defaults) and `sections` (the ordered list of clips). The descriptor is the LLM-clear authoring standard — validate against the schema, don't guess fields.

Sources of truth (in order of authority):

- **Machine-readable JSON Schema:** `docs/template-descriptor.schema.json` — generated from the zod source; feed it to an editor/agent for autocompletion + validation. Regenerate with `pnpm --filter ffmpeg-video-composer generate:schema`.
- **Full field reference + examples:** `docs/template-configuration.md`.
- **zod source (every field has `.describe()`):** `packages/ffmpeg-video-composer/src/schemas/` (`template.schemas.ts` re-exports `effects`/`global`/`filter`/`section`).
- **Validator:** `packages/ffmpeg-video-composer/src/services/TemplateValidator.ts` (+ `templateValidationRules.ts`).
- **Built-in examples:** `packages/leclap-creative-kit/src/templates/*.json`.

## Two layers: structured sugar vs. raw filters

- **Structured sugar** (prefer this): `transition`, `look`, `grade`, `motion`, `audio`, `layers`, animation `inputs`, and text sugar (`caption`, `titleCard`, `lowerThird`, `reveal`, `global.overlays`/`look`/`grade`). Editor-friendly camelCase intents that compile to ordinary, on-device-safe FFmpeg filters.
- **Raw filters** (escape hatch): `filters[]`, `inputs[].filters`, `maps[]` — passed to FFmpeg verbatim. Their `values` keys stay FFmpeg-native (`x/y/w/h/c/t/fontcolor/fontsize/fontfile/alpha/d/st/color/box/boxcolor/boxborderw`), **not** camelCase, by design.

## Structure

```jsonc
{
  "global": {
    "variables": { "video": "https://…/earth.mp4" },
    "orientation": "landscape", // "landscape" (1280x720) | "portrait" (720x1280) | "square" (1080x1080)
    "musicEnabled": true,
    "music": { "name": "track.mp3" },
    "transition": { "type": "fade", "duration": 0.4 }, // xfade name | "cut"; duration in SECONDS
    "audio": { "sourceVolume": 1, "musicVolume": 0.5 },
  },
  "sections": [
    {
      "name": "intro",
      "type": "video", // see Section types
      "options": { "videoUrl": "{{ video }}", "duration": 4, "musicVolume": 1 }, // SECONDS
      "transition": { "type": "wipeleft", "duration": 0.4 }, // boundary AFTER this section
      "look": "cinematic",
      "filters": [{ "type": "fadein", "values": { "color": "#000000" } }],
    },
  ],
}
```

## Section types (discriminated on `type`)

| `type`             | Use for                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `video`            | A clip from `options.videoUrl` (remote or local).                         |
| `project_video`    | A clip recorded from the device camera; supports `framingGuide`.          |
| `image_background` | Still image (`options.pictureUrl`); the only type that allows `kenburns`. |
| `color_background` | Solid colour (`options.backgroundColor`) + composited `layers`.           |
| `form`             | User input fields (`options.fields`); each field `name` → `{{ name }}`.   |
| `music`            | Audio-only / timeline-padding section.                                    |

Segments live in `packages/ffmpeg-video-composer/src/editor/segments/`; `SegmentFactory` maps `type` → class.

## Capabilities (brief)

- **Transitions** — `transition: { type, duration? }` on `global` and/or per section (boundary after that section). `type` is an xfade name (see `XFADE_TRANSITIONS`) or `"cut"`. Effective duration = section ?? global ?? 0.3 s. Any non-`cut` boundary forces a full-timeline re-encode (costly on WASM/on-device); cuts are a fast stream-copy concat.
- **Looks & grade** — `look` (one of `cinematic`/`warm`/`cool`/`vintage`/`noir`/`vivid`/`dreamy`) and `grade` (brightness/contrast/saturation/gamma/hue/colorBalance/blur/curvesPreset) → `eq`/`colorbalance`/`curves`/`gblur`/`hue`.
- **Motion** — ordered `motion[]`: `kenburns` (image_background only), `rotate`, `crop`, `flip` → `zoompan`/`rotate`/`crop`/`hflip`/`vflip`.
- **Audio polish** — `global.audio`: `sourceVolume`, `musicVolume`, `normalize` (`loudnorm`/`dynaudnorm`), `ducking` (bool or fine-grained). Per-section `options.audioFade` (`in`/`out`, `afade`) and `options.musicVolume`.
- **Layers** — `color_background` `options.layers[]`: solid/opacity/gradient boxes composited over the base colour.
- **Framing guide** — `project_video` `options.framingGuide` (`silhouette`): a **recording-UI overlay only**, never rendered into the video.
- **Animation inputs** — one input per animation: an `image2` PNG-sequence ZIP **or** a single `.apng`/`.webp`/`.gif`/`.webm`. `options.loop` → `stream_loop`, `options.persistent` → `eof_action=repeat`.
- **Text sugar** — prefer these over hand-positioned `drawtext`: `caption` (styled overlay), section `titleCard` on `color_background` (kicker/headline/subtitle/accent/fade — collapses ~80-line intros), section `lowerThird` on any visual section (title/subtitle/badge band, composites above animations), and `reveal` (`none`/`fade`/`rise`/`slide-left`/`slide-right`, bare string or `{type,delay,duration,distance}`) on any of them. Sized from the output scale, so they render in any orientation.
- **Global decorations** — authored once in `global`, applied to every section (sibling of `global.animations`): `global.overlays[]` (whole-video text/brand watermark, with `position` anchor + optional `sections` subset), `global.look` / `global.grade` (whole-video colour). Removes per-section `{{ brand }}` repetition.

## Variables, filters, maps

- **Variables** — define in `global.variables` (string or string[]); reference anywhere with `{{ name }}`. `{{ colorN }}` is 1-indexed into `colorsList`; `{{ form_field }}` is a form field's value.
- **Filters** — `{ type, value?, values?, range? }`. `type` is a raw FFmpeg filter name. `values` keys are FFmpeg-native (see above). Common types: `fadein`, `fadeout`, `scale`, `drawtext`, `drawbox`, `overlay`, `vignette`.
- **Maps** — `{ inputs, outputs, filters?, options? }` to route FFmpeg streams explicitly; `@name` references an input/animation pad; the final output must end with `final`. Only needed for multi-input/overlay sections.
- `text`, `title`, `description`, field `label` are `Translation` objects (`{ "en": "…" }`) for i18n.

## Validating

Validate with `TemplateValidator` (zod + cross-field rules). zod reports the exact path/field on failure. Cross-field rules reject: a non-`cut` transition on the last rendering section (`dangling_transition`); an effective transition duration ≥ the smaller adjacent declared `duration` (`transition_too_long`); `kenburns` outside `image_background`/video (`motion_unsupported_section`); a whole-video animation with no url (`global_animation_missing_url`); and a `caption`/`global.overlays` `font` that is neither a bundled id nor a `.ttf` (`unknown_font` — catches typos that would otherwise silently fall back to the default). After editing any `.json`, run `pnpm fmt`.

## Common mistakes

- Inventing option keys — `global` and section `options` are `strict`; only schema keys are valid.
- Using **old field names**: `audioVolumeLevel` → `audio.sourceVolume`; `transitionDuration` → `transition.duration`; `musicVolumeLevel` → `musicVolume`; `type: "frame"` / `frames`/`frequency`/`overlay` → a single `type: "animation"` input.
- Forgetting **durations are seconds** everywhere (`project_video` duration was previously ms — `30000` becomes `30`).
- Volumes (`sourceVolume`/`musicVolume`) must be 0..1; `duration`/`speed`/`transition.duration` must be positive.
- Using a `{{ var }}` that isn't declared in `global.variables` (or isn't a `colorN`/form field).
- Wrong `type` string — it must be one of the literals above (discriminated union).
