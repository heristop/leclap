# Easy overlay-text editor (Canva-style)

- Date: 2026-06-08
- Status: approved (design); plan pending
- Area: `apps/le-clap-web` (video section editor), `packages/core` (bundled fonts + preload), shared copy-script. Expo mirror is a follow-up.

## Goal

Replace the complex overlay-text UI on the "Your video" section (per-overlay form rows + a separate drag positioner) with a single direct-manipulation canvas: add/edit/move/style multiple text overlays directly on the video frame. Add dynamic font sizing and font selection.

## Decisions (settled with the user)

- **On-frame editing** (Canva-style) — the video frame is the editor; no separate form rows.
- **Font size** = drag a corner handle (live) AND a size slider (precision).
- **6 curated bundled fonts**: Rubik, Oswald, Bebas Neue, Playfair Display, Pacifico, Roboto Mono (TTF, OFL — free).
- One **docked toolbar** below the frame acting on the selected overlay (not floating).
- Web first; Expo mirror later.

## Interaction (OverlayCanvas)

A video-frame box, aspect-correct per template orientation (`aspect-video` landscape / `aspect-[9/16]` portrait), renders every overlay live with its real font, size, color, and box.

- **Select**: click an overlay → selection outline + 4 corner handles; the toolbar reflects it. Click empty frame → deselect.
- **Move**: pointer-drag the overlay body → updates `x`/`y` (fractions in [0,1]), clamped. `stopPropagation` so the section card's grip-drag never arms.
- **Resize**: pointer-drag a corner handle → scales `fontsize` live (see WYSIWYG sizing). The toolbar slider does the same.
- **Edit text**: double-click → an inline `<textarea>`/contentEditable positioned over the box; supports `{{firstname}}`-style variables. Enter/blur commits.
- **Add**: "+ Add text" appends `newOverlay()` at center (0.5, 0.5), selects it, opens inline edit.
- **Delete**: from the toolbar (and Backspace/Delete when selected and not editing).
- **Keyboard a11y**: when an overlay is selected (not editing), arrow keys nudge position 2%; the selection is reachable by Tab (each overlay box is a focusable `button`/`div role="button"` with an aria-label).

## Toolbar (selected overlay, docked below frame)

`Font ▾` (the 6 fonts) · `Size` slider (with the current px) · `Color` (existing `ColorPicker`) · `Box` checkbox → reveals `Box color` (`ColorPicker`) · `Delete`. Disabled/hidden when nothing is selected (show a hint: "Select a text, or add one"). An **`Insert variable ▾`** control lists the template's form-field variables (see below) and inserts `{{ name }}` into the selected overlay's text at the caret.

## Dynamic variables (form fields + global)

Overlay text may contain `{{ name }}` tokens that the engine substitutes at compile time (the web compile merges variables into `global.variables`, and core's VariableManager substitutes them). Two sources of variables, both insertable:

- **Form-field variables** — collected from the template's form sections: every `field.name` across all `kind:'form'` sections in `EditorState.sections`. Their values come from the viewer's form input at build time.
- **Global variables** — author-defined template constants. The author manages a small list of `{ name, value }` pairs (a "Variables" editor in `MetadataFields`); these are written to `global.variables` in the descriptor and substituted at compile. Useful for brand text, dates, hashtags, etc. (Existing defaults like `color1`/`color2` continue to be merged by the compile service.)
- The selected-overlay toolbar's **`Insert variable ▾`** lists the union of form-field names + global-variable names; choosing one inserts `{{ name }}` at the caret. With no variables available the control is disabled with a hint.
- The canvas preview renders the raw token (e.g. `{{ firstname }}`); substitution happens only at compile.
- A small pure helper `collectVariables(state): string[]` (form field names ∪ global var names) is derived in `TemplateEditor` and passed to the toolbar — unit-tested.

### Model addition for global variables

- `EditorState` gains `globalVariables: { name: string; value: string }[]` (default `[]`).
- `buildDescriptor`: merge them into `global.variables` (`Object.fromEntries(globalVariables.filter(v => v.name).map(v => [v.name, v.value]))`), alongside whatever the compile service already injects.
- `toEditorState`: read string entries of `global.variables` back into `globalVariables` rows.

## Fonts

- Bundle 6 TTFs at `packages/core/src/shared/library/fonts/<Font>.ttf` (download the OFL TTFs from Google Fonts during implementation; record license in `CREDITS`).
- The existing `scripts/copy-core-assets.mjs` copies `library/fonts/*` into `apps/le-clap-web/public/fonts/` and `apps/le-clap-expo/assets/fonts/`.
- Web preview fidelity: `@font-face` declarations (in `src/index.css` or a dedicated css) load the same TTFs from `/fonts/<Font>.ttf` so the canvas shows the real face.
- A shared catalog `packages/core/src/shared/library/fonts.ts`: `FONTS: { id, label, file, cssFamily }[]` (e.g. `{ id:'rubik', label:'Rubik', file:'Rubik.ttf', cssFamily:'Rubik' }`).
- Compile: each overlay's `drawtext` filter sets `fontfile: '<file>'` (e.g. `'Oswald.ttf'`). `coreCompilationService.preloadBundledFonts` is extended to preload all six TTFs into the build dir (so WASM drawtext finds them); today it preloads only `Rubik.ttf`.

## Model + compile

- Extend the existing `TextOverlay` (in `templateEditorModel.ts`) with `font: string` (a font id; default `'rubik'`).
- `newOverlay()` → `{ text:'', x:0.5, y:0.5, fontsize:48, fontcolor:'#ffffff', box:false, boxcolor:'#000000', font:'rubik' }`.
- `buildDescriptor`: per non-empty overlay, the `drawtext` filter's `fontfile` = `findFont(overlay.font)?.file ?? 'Rubik.ttf'` (instead of the hard-coded `'Rubik.ttf'`); `fontsize`, `fontcolor`, `x:(w-text_w)*<frac>`, `y:(h-text_h)*<frac>`, and box keys as already implemented.
- `toEditorState`: parse `font` back from the filter's `fontfile` (map file → id; default `rubik`); other fields as today.
- **WYSIWYG sizing**: `fontsize` stays absolute video px (drawtext is absolute px). The canvas scales it to the preview: `previewPx = fontsize * (previewBoxHeightPx / refVideoHeight)`, where `refVideoHeight` = 1080 (landscape) / 1920 (portrait). The resize handle reads the dragged box height and back-computes `fontsize = round(draggedHeightPx / previewBoxHeightPx * refVideoHeight)`, clamped to a sane range (e.g. 8–300).

## Files

New (web): `OverlayCanvas.tsx` (frame + overlays + drag/resize/select/inline-edit), `OverlaySelectedToolbar.tsx` (or inline in OverlayCanvas), font `@font-face` CSS.
New (core/shared): `packages/core/src/shared/library/fonts.ts` + `library/fonts/*.ttf`.
Changed: `templateEditorModel.ts` (font on overlay + fontfile mapping), `TemplateEditor.tsx` (video branch → OverlayCanvas, remove the old form-rows + `TextPositioner` usage), `scripts/copy-core-assets.mjs` (copy fonts), `coreCompilationService.ts` (preload all fonts), `src/index.css` (@font-face), CREDITS.
Removed/retired: the per-overlay `OverlayEditor` form rows and the standalone `TextPositioner` (superseded by OverlayCanvas) — keep `TextPositioner` only if still referenced elsewhere; otherwise delete.

## Testing

- `templateEditorModel.test.ts`: overlays incl. `font` → drawtext `fontfile` mapping (and back); multiple overlays → multiple filters; box/x/y as before; round-trip.
- `fonts.ts` catalog integrity test: every font's TTF exists under `public/fonts` after the copy script (mirror the `mediaCatalog` integrity test).
- OverlayCanvas: build + typecheck + manual (repo doesn't DOM-test React components). Extract any pure geometry (px↔fraction, px↔fontsize) into a tiny tested helper.
- Gates: web suite green, `vp lint` 0/0 on touched files, `pnpm --filter le-clap build`, fonts preload verified in a compile smoke.

## Out of scope (follow-ups)

- Expo mirror of the canvas editor (separate effort; RN pan/pinch gestures).
- Text rotation, alignment, opacity, stroke/shadow (could be added to the toolbar later).
- Per-font weight/italic variants (one weight per family for now).
