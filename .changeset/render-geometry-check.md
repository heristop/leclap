---
'ffmpeg-video-composer': minor
'@leclap/cli': minor
'@leclap/mcp': minor
---

Measure text contrast from rendered pixels, on request.

The render-free geometry check never sees a pixel: text over a picture, under a grade or a look is only flagged for lacking a box, outline or shadow, and its real contrast stays unknown. `renderedGeometryWarnings()` (Node entry) renders the sections that hold text through the engine twice — the second time with every glyph recoloured, so the glyphs are exactly the pixels that change — reads one frame per piece of text where it rests, and scores the text against the pixels around it (lower quartile, WCAG ratio). It reports `text_low_contrast_rendered` below 3:1, and over a fixed backdrop (colour card, picture) it replaces the render-free contrast and over-footage findings for that text.

`leclap validate --render` and `validate_template` with `render: true` run it. It costs seconds and needs a native FFmpeg with `drawtext`; without one, or when the render fails, it returns the render-free findings and says why. Findings stay advisory and never change `success` or the exit code.
