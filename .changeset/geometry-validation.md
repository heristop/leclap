---
'ffmpeg-video-composer': minor
'@leclap/cli': minor
'@leclap/mcp': minor
---

Catch templates that are valid but visually broken — before rendering.

`TemplateValidator.getGeometryWarnings()` lowers each section through the renderer's own text and box filters (captions, title cards, lower thirds and their badges, global text overlays, authored `drawtext`/`drawbox`) and reports text that:

- runs off the frame, or out of the title-safe area;
- collides with other text on screen at the same time;
- is drawn under a band or panel that paints over it;
- is too small to read on a phone;
- has too little contrast against what it sits on;
- sits over footage or an image with no box, outline or shadow.

Each finding says what to change. Findings are advisory: they never enter `errors` and never change `success`, so `leclap validate` stays usable as a CI gate. At most 20 are returned, worst first; when more exist, the last one says how many were left out.

`leclap validate` counts the findings in its headline and lists them under it; `--json` carries them on a `warnings` key (absent when there is nothing to report). `validate_template` returns them on a new optional `geometry` field, one line each. A finding drawn from an estimate says why: `(approx: font unavailable, width estimated)`, `(approx: {{ variable }} length unknown until render)` or `(approx: section duration assumed)`.

Widths come from the real fonts. When a font is not bundled — a published install of the CLI or MCP — `validate` fetches it from the LeClap asset catalog the renderer uses (5s timeout per font); offline, it falls back to an estimate and marks the finding approximate.
