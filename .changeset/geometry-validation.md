---
'ffmpeg-video-composer': minor
'@leclap/cli': minor
'@leclap/mcp': minor
---

Catch text that overflows the frame, collides with other text, or renders too small to read — before rendering.

`TemplateValidator.getGeometryWarnings()` measures where each caption and lower third will land, using real glyph advances read from the bundled TrueType fonts, and returns advisory warnings. Findings never enter `errors` and never change `success`, so `leclap validate` stays usable as a CI gate.

`leclap validate` prints the findings under its existing result, and `--json` carries them on a `warnings` key (absent entirely when there is nothing to report). `validate_template` returns the same findings on a new optional `geometry` field, one compact line each. A finding measured from an estimate rather than from real metrics is marked `(approx: estimated, not measured)`.
