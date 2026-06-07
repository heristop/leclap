---
name: authoring-video-templates
description: Use when creating or editing a video template JSON, adding or changing sections/filters/maps/variables, or debugging template validation errors in ffmpeg-video-composer.
---

# Authoring Video Templates

## Overview

A template is a JSON descriptor that the engine compiles into a video. It has two top-level keys: `global` (defaults) and `sections` (the ordered list of clips). The schema is the source of truth — validate against it, don't guess fields.

- Schema (zod): `packages/core/src/schemas/template.schemas.ts`
- Validator: `packages/core/src/services/TemplateValidator.ts`
- Human reference: `docs/template-schema.md`
- Built-in examples: `packages/core/src/shared/templates/*.json` (start from `concat_videos_with_music.json`)

## Structure

```jsonc
{
  "global": {
    "variables": { "video": "https://…/earth.mp4", "colorTransition": "#000000" },
    "orientation": "landscape", // "landscape" | "portrait"
    "musicEnabled": true,
    "transitionDuration": 0.1, // positive number
    "music": { "name": "track.mp3" },
  },
  "sections": [
    {
      "name": "intro",
      "type": "video", // see Section types
      "options": { "videoUrl": "{{ video }}", "duration": 4, "musicVolumeLevel": 1 },
      "filters": [
        { "type": "fadein", "values": { "color": "{{ colorTransition }}" } },
        { "type": "fadeout", "values": { "color": "{{ colorTransition }}" } },
      ],
    },
  ],
}
```

## Section types (discriminated on `type`)

| `type`             | Use for                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `video`            | A clip from `options.videoUrl` (remote or local).                 |
| `project_video`    | A user-supplied clip (mapped via `ProjectConfig.userVideoPaths`). |
| `image_background` | Still image (`options.pictureUrl`) with overlays.                 |
| `color_background` | Solid color (`options.backgroundColor`) with effects.             |
| `form`             | User input fields (`options.fields`).                             |
| `music`            | Audio-only section.                                               |

Renderable visual segments are implemented in `packages/core/src/editor/segments/` (`VideoSegment`, `ProjectVideoSegment`, `ImageBackgroundSegment`, `ColorBackgroundSegment`); `SegmentFactory` maps `type` → class.

## Variables, filters, maps

- **Variables** — define in `global.variables` (string or string[]); reference anywhere with `{{ name }}`. Substitution is handled by `VariableManager`.
- **Filters** — `{ type, value?, values?, range? }`. `values` supports `w/h/x/y/c/t/text/fontcolor/fontsize/fontfile/alpha/d/st/color`. Common types: `fadein`, `fadeout`, `scale`, `drawtext`, `overlay`.
- **Maps** — `{ inputs: ["0:v","0:a"], outputs: ["1:v"], filters?, options? }` to route FFmpeg streams explicitly. Only needed for multi-input/overlay sections.
- `text`, `title`, `description`, and field `label` are `Translation` objects (`{ locale: string }`) for i18n.

## Validating

Run the template through `TemplateValidator` (zod). On failure, zod reports the exact path/field — fix the JSON to match `template.schemas.ts`. After editing any `.json`, run `pnpm fmt`.

## Common mistakes

- Inventing option keys — only keys in `BaseSectionOptionsSchema` (+ the per-type extension) are valid.
- `musicVolumeLevel` / `audioVolumeLevel` must be between 0 and 1; `duration`, `speed`, `transitionDuration` must be positive.
- Using a `{{ var }}` that isn't declared in `global.variables`.
- Wrong `type` string — it must be one of the literals above (discriminated union).
