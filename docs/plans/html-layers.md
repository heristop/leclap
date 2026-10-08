# HTML layers: style a moment with HTML and CSS

> Status: in progress · Scope: `ffmpeg-video-composer` (schema, rasteriser, asset stage), `leclap-web` (builder),
> `leclap-expo` (on-device rasteriser), `leclap-mcp` (catalog, preview)

## Why

Text in LeClap today is drawn by FFmpeg's `drawtext` (kinetic type, title cards, lower thirds, captions). It is
fast and portable, but it can't do layout: no wrapping into boxes with padding, no mixed weights or colours in a
line, no badges, price tags, address cards, tables, chips or icons next to text.

HTML plus CSS is a layout language an agent (or a designer) already knows how to write. Filled from template
fields and animated by the motion system we already have, it covers those layouts without a new vocabulary.

## Principles

1. **Deterministic, like every other layer.** Same template, same fields, same bytes on Node, the browser and the
   phone. That rules out screenshotting a real browser engine (Chromium, WebKit and Blink render text and
   anti-aliasing differently per platform and version).
2. **A still layer, animated by the engine.** HTML renders once to a transparent PNG; entrances, exits, kinetic
   motion, camera and fx come from the existing vocabulary. No CSS animations or JavaScript.
3. **A documented subset, not "any HTML".** Flexbox layout, text and font styling, colours and gradients,
   borders and radius, shadows, padding and margins, images from the library or the template's own inputs. What's
   unsupported is reported, not silently dropped.
4. **Safe input.** No scripts, no event handlers, no iframes or forms, no network: fonts come from the font
   registry, images from the template's assets.

## The template shape

An HTML layer is a new overlay input type, next to `image` and `animation` (same placement and motion options):

```jsonc
"inputs": [
  {
    "name": "address_card",
    "type": "html",
    "html": "<div class='card'><span class='tag'>For sale</span><p>{{ form_1_address }}</p></div>",
    "css": ".card { display: flex; flex-direction: column; gap: 12px; padding: 28px; border-radius: 24px; background: $color.surface } .tag { color: $color.accent; font: 600 28px $font.body } p { font: 700 56px $font.display; color: $color.fg }",
    "width": 720,
    "height": 320,
    "options": { "position": "64:560", "motion": { "type": "rise", "delay": 0.4 } }
  }
]
```

- `{{ var }}` fields and theme tokens (`$color.*`, `$font.*`) resolve before rendering, exactly as in other
  string fields; field values are HTML-escaped.
- `width`/`height` are the layer's box in output pixels (bounded, e.g. ≤ 1920×1920); the PNG is rendered at 2×
  for the 1080p presets and scaled into place.
- Reused across sections like any input; a section's maps can reference it with `@address_card`.

## How it renders

1. **Resolve** fields and tokens, sanitise the HTML (allowlist of tags and attributes), and validate the CSS
   against the supported subset (advisory `html_unsupported_css` names each dropped property).
2. **Layout + vector:** [Satori](https://github.com/vercel/satori) turns the HTML/CSS subset into SVG (Yoga flexbox
   layout, text shaped with the bundled fonts via the font registry).
3. **Raster:** [resvg](https://github.com/RazrFalcon/resvg) (`@resvg/resvg-wasm`) renders the SVG to a
   transparent PNG. Both are WebAssembly, so the bytes are identical wherever they run.
4. **Asset stage:** exposed as an `html:<hash>` URL, rendered and written to the build filesystem the way `sprite:`
   and `panel:` are (`AssetManager.fetchMedia`), cached by content hash, then composited by the existing overlay
   path (`inputs[]` → overlay with position/scale/motion).

Per platform:

| Platform                           | Where Satori + resvg run                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node (CLI, MCP, server)            | In process (WASM).                                                                                                                                                  |
| Browser (web builder, WASM render) | In the page, the same WASM bundle; also powers the builder's live preview.                                                                                          |
| Phone (Expo, Hermes)               | Hermes has no WebAssembly, so a hidden `react-native-webview` runs the same bundle and returns the PNG as bytes. The WebView is created once per render and reused. |

## Builder and agents

- **Web builder:** an HTML layer in the overlay picker with two code fields (HTML, CSS), a field chip list that
  inserts `{{ var }}`, a live preview rendered by the same rasteriser, and the existing drag-to-place and resize.
- **MCP:** documented in `get_template_schema`; `motionCatalog()` gains an `html` entry (supported subset, layout
  recipes: card, badge, price tag, two-column stat); `render_frames` already previews it in context. A compact
  description keeps the web AI prompt within its size budget.
- **Validation:** `html_unsupported_css`, `html_overflow` (content taller than the box, measured from the layout),
  `html_missing_field`, `html_font_unknown`, `html_too_large` (box over the bound).

## Phases

1. **Engine (Node):** schema, sanitiser, Satori + resvg rasteriser behind an `html:` asset, overlay compositing,
   fields and tokens, advisories. Tests: golden PNG checksums, sanitiser cases, subset validation, a real render.
2. **Browser:** load the WASM in the web app and in the browser engine entry; builder preview and editing UI.
3. **Phone:** the WebView rasteriser in Expo, wired into the RN filesystem adapter; on-device render of a template
   with an HTML layer on the Android emulator and the iOS simulator; measure time per layer.
4. **Docs and samples:** template-configuration section, gallery sheet, one sample template (a real-estate card), MCP README.

## Out of scope

- CSS animations, transitions and JavaScript (motion comes from the engine).
- Arbitrary web fonts or remote images (fonts via the registry, images via the template's assets).
- Full browser fidelity: the subset is what Satori supports, documented.

## Risks

- **Bundle size:** Satori + resvg WASM add roughly 2–3 MB; load them lazily, only when a template has an HTML layer.
- **Phone render time:** the WebView round trip adds latency; render each distinct layer once, cache by hash, and
  measure against a budget (e.g. 150 ms per layer on the Pixel 3a emulator).
- **CSS expectations:** people will try unsupported CSS. The advisory and the documented subset are the answer;
  the builder preview shows exactly what renders.
- **Licences:** Satori (MPL-2.0) and resvg (Apache-2.0/MIT) are compatible with the project; confirm against the
  LGPL on-device constraints (they don't touch FFmpeg).
