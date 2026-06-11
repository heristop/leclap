# Easy Overlay-Text Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Repo owner rule:** never run `git commit`/`git push` — implementers leave changes in the working tree; the owner's tooling commits.

**Goal:** Replace the video section's overlay-text form-rows + mini-positioner with a Canva-style `OverlayCanvas` (add/select/move/inline-edit overlays on the video frame, corner-resize + slider sizing), add 6 bundled TTF fonts with true preview, and make `{{ variables }}` insertable from form fields + author-defined global variables.

**Architecture:** Fonts live in `packages/core/src/shared/library/fonts` (shared, copied into both apps by `scripts/copy-core-assets.mjs`); the web previews them via `@font-face` and the WASM compile preloads them. The existing `TextOverlay[]` model gains `font`; `EditorState` gains `globalVariables`. A new `OverlayCanvas` component owns all direct-manipulation; pure geometry/variable helpers are unit-tested. Builder/compile path is unchanged except per-overlay `fontfile` + preloading.

**Tech Stack:** React 19 + Vite + Tailwind (React Compiler on — no manual memo), vitest (node env, import from `vitest`), strict `vp lint`, FFmpeg-WASM `drawtext`. Spec: `docs/superpowers/specs/2026-06-08-easy-overlay-text-editor-design.md`.

**Verification gates (per task):** `pnpm --filter leclap exec vitest run`, `pnpm lint` (0/0 on touched files), `pnpm --filter leclap build`.

---

### Task C1: Fonts foundation (core + copy-script + preview + preload)

**Files:**

- Create: `packages/core/src/shared/library/fonts/*.ttf` (6 fonts), `packages/core/src/shared/library/fonts.ts`, `apps/leclap-web/src/data/fonts.test.ts`
- Modify: `scripts/copy-core-assets.mjs`, `apps/leclap-web/src/application/usecases/coreCompilationService.ts`, `apps/leclap-web/src/index.css`, `apps/leclap-web/public/CREDITS.txt`

- [ ] **Step 1: Source the 6 TTFs.** Download the OFL TTF for each from Google Fonts (one regular weight each) into `packages/core/src/shared/library/fonts/`: `Rubik.ttf`, `Oswald.ttf`, `BebasNeue.ttf`, `PlayfairDisplay.ttf`, `Pacifico.ttf`, `RobotoMono.ttf`. (Use `curl` against the `github.com/google/fonts` raw OFL paths, e.g. `https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf` — a variable font is fine; for fixed-weight names prefer the `static/` variants when present. Verify each with `file <f>` → "TrueType" and size > 20 KB.) Record each font's license (OFL) + source.

- [ ] **Step 2: Catalog module.** Create `packages/core/src/shared/library/fonts.ts`:

```ts
export interface FontEntry {
  id: string;
  label: string;
  file: string;
  cssFamily: string;
}

export const FONTS: FontEntry[] = [
  { id: 'rubik', label: 'Rubik', file: 'Rubik.ttf', cssFamily: 'Rubik' },
  { id: 'oswald', label: 'Oswald', file: 'Oswald.ttf', cssFamily: 'Oswald' },
  { id: 'bebas', label: 'Bebas Neue', file: 'BebasNeue.ttf', cssFamily: 'Bebas Neue' },
  { id: 'playfair', label: 'Playfair Display', file: 'PlayfairDisplay.ttf', cssFamily: 'Playfair Display' },
  { id: 'pacifico', label: 'Pacifico', file: 'Pacifico.ttf', cssFamily: 'Pacifico' },
  { id: 'mono', label: 'Roboto Mono', file: 'RobotoMono.ttf', cssFamily: 'Roboto Mono' },
];

export const findFont = (id: string): FontEntry | undefined => FONTS.find((f) => f.id === id);
export const DEFAULT_FONT_ID = 'rubik';
```

- [ ] **Step 3: Copy script.** In `scripts/copy-core-assets.mjs`, add `fonts` to the copied dirs: copy `packages/core/src/shared/library/fonts/*` → `apps/leclap-web/public/fonts/` AND `apps/leclap-expo/assets/fonts/`. (Mirror the existing musics/backgrounds copy loop; keep the existing `Rubik.ttf` in web `public/fonts` — overwrite is fine.) Then run `node scripts/copy-core-assets.mjs` and confirm `apps/leclap-web/public/fonts/` has all 6.

- [ ] **Step 4: @font-face (web preview).** In `apps/leclap-web/src/index.css`, add one `@font-face` per font pointing at `/fonts/<file>` (e.g. `@font-face{font-family:'Oswald';src:url('/fonts/Oswald.ttf') format('truetype');font-display:swap;}`). These let the canvas render the real face.

- [ ] **Step 5: Preload all fonts for WASM.** In `coreCompilationService.ts`, change `preloadBundledFonts`'s `const fonts = ['Rubik.ttf']` to the full list (import `FONTS` from `@ffmpeg-video-composer/core/src/shared/library/fonts.ts` and map `.file`, or inline the 6 filenames). The existing loop fetches `/fonts/<font>` and writes to the build dir, so all 6 become available to `drawtext`.

- [ ] **Step 6: Integrity test.** Create `apps/leclap-web/src/data/fonts.test.ts` (mirror `mediaCatalog.test.ts`): import `FONTS` from the core path, assert unique ids and that every `file` exists under `apps/leclap-web/public/fonts/` (resolve via `import.meta.url`). Run `pnpm --filter leclap exec vitest run src/data/fonts.test.ts` → pass.

- [ ] **Step 7: CREDITS.** Append a "FONTS" block to `apps/leclap-web/public/CREDITS.txt` listing the 6 families, "SIL Open Font License 1.1", and the Google Fonts source.

- [ ] **Step 8: Verify + (no commit).** `pnpm lint 2>&1 | grep -iE "fonts\.ts|copy-core-assets|coreCompilationService"` empty; `pnpm --filter leclap build` succeeds. Leave changes uncommitted.

---

### Task C2: Model — per-overlay font + global variables

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.ts`
- Test: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.test.ts`

- [ ] **Step 1: Failing tests.** Add to `templateEditorModel.test.ts`:

```ts
it('emits the chosen fontfile per overlay', () => {
  const s = baseState({
    sections: [
      {
        kind: 'video',
        duration: 5,
        mute: false,
        overlays: [
          { text: 'Hi', x: 0.5, y: 0.5, fontsize: 48, fontcolor: '#fff', box: false, boxcolor: '#000', font: 'oswald' },
        ],
      },
    ],
  });
  const filters = buildDescriptor(s).sections?.[0].filters ?? [];
  expect(filters[0].values.fontfile).toBe('Oswald.ttf');
});

it('round-trips overlay font through toEditorState', () => {
  const start = baseState({
    sections: [
      {
        kind: 'video',
        duration: 5,
        mute: false,
        overlays: [
          {
            text: 'Hi',
            x: 0.5,
            y: 0.5,
            fontsize: 48,
            fontcolor: '#fff',
            box: false,
            boxcolor: '#000',
            font: 'pacifico',
          },
        ],
      },
    ],
  });
  const back = toEditorState(asTemplate(start)).sections.find((x) => x.kind === 'video');
  expect((back as { overlays: { font: string }[] }).overlays[0].font).toBe('pacifico');
});

it('writes author global variables into global.variables', () => {
  const d = buildDescriptor(baseState({ globalVariables: [{ name: 'brand', value: 'LeClap' }] }));
  expect(d.global?.variables?.brand).toBe('LeClap');
});

it('round-trips global variables', () => {
  const start = baseState({ globalVariables: [{ name: 'brand', value: 'LeClap' }] });
  expect(toEditorState(asTemplate(start)).globalVariables).toContainEqual({ name: 'brand', value: 'LeClap' });
});
```

(Adjust `baseState`/`asTemplate` helpers to include `globalVariables: []` and the `font` field as needed.)

- [ ] **Step 2: Run → fail.** `pnpm --filter leclap exec vitest run src/presentation/components/admin/templateEditorModel.test.ts`.

- [ ] **Step 3: Implement.** In `templateEditorModel.ts`:
  - Import `findFont, DEFAULT_FONT_ID` from `@ffmpeg-video-composer/core/src/shared/library/fonts.ts`.
  - Add `font: string` to the `TextOverlay` interface; `newOverlay()` sets `font: DEFAULT_FONT_ID`.
  - In the overlay→`drawtext` mapping, set `fontfile: findFont(overlay.font)?.file ?? 'Rubik.ttf'` (replace the hard-coded `'Rubik.ttf'`).
  - In overlay parsing (`videoSectionFrom`), map `values.fontfile` back to a font id: add a pure `fontIdFromFile(file: string | undefined): string` = `FONTS.find(f => f.file === file)?.id ?? DEFAULT_FONT_ID`; set `font` on each parsed overlay.
  - Add `globalVariables: { name: string; value: string }[]` to `EditorState` (default `[]`). In `buildDescriptor`, set `global.variables = { ...existing, ...Object.fromEntries(state.globalVariables.filter(v => v.name.trim()).map(v => [v.name, v.value])) }`. In `toEditorState`, read string entries of `global.variables` into `globalVariables` rows.
  - Add `export function collectVariables(state: EditorState): string[]` = unique union of every `field.name` across `kind:'form'` sections + every `globalVariables[].name` (non-empty). Unit-test it.

- [ ] **Step 4: Run → pass.** Same command; all green.

- [ ] **Step 5: Verify.** `pnpm lint 2>&1 | grep -i templateEditorModel` empty; `pnpm --filter leclap build` succeeds. No commit.

---

### Task C3: OverlayCanvas UI (+ toolbar, insert-variable, global-variables editor)

**Files:**

- Create: `apps/leclap-web/src/presentation/components/admin/OverlayCanvas.tsx`, `apps/leclap-web/src/presentation/components/admin/overlayGeometry.ts`, `apps/leclap-web/src/presentation/components/admin/overlayGeometry.test.ts`
- Modify: `apps/leclap-web/src/presentation/components/admin/TemplateEditor.tsx` (video branch → `OverlayCanvas`; add the global-variables editor in `MetadataFields`; remove the old per-overlay form rows; drop `TextPositioner` usage if now unused)

- [ ] **Step 1: Geometry helpers (TDD).** Create `overlayGeometry.ts` with pure helpers + test them in `overlayGeometry.test.ts`:

```ts
export const refVideoHeight = (orientation: 'landscape' | 'portrait'): number =>
  orientation === 'portrait' ? 1920 : 1080;
// preview px shown for a video-px fontsize, given the preview box height
export const previewFontPx = (fontsize: number, previewH: number, orientation: 'landscape' | 'portrait'): number =>
  fontsize * (previewH / refVideoHeight(orientation));
// back-compute video-px fontsize from a dragged preview height
export const fontSizeFromPreview = (
  draggedH: number,
  previewH: number,
  orientation: 'landscape' | 'portrait'
): number => Math.min(300, Math.max(8, Math.round((draggedH / previewH) * refVideoHeight(orientation))));
// clamp a pointer position within the box to a [0,1] fraction
export const clampFraction = (value: number, size: number): number => Math.min(1, Math.max(0, value / size));
```

Tests: `previewFontPx(48, 540, 'landscape')===24`; `fontSizeFromPreview` clamps to [8,300] and round-trips ~ `previewFontPx`; `clampFraction` clamps.

- [ ] **Step 2: Run geometry test → it should pass after Step 3's file exists.** `pnpm --filter leclap exec vitest run src/presentation/components/admin/overlayGeometry.test.ts`.

- [ ] **Step 3: Build `OverlayCanvas.tsx`.** Implement per the spec (`docs/superpowers/specs/2026-06-08-easy-overlay-text-editor-design.md`, "Interaction" + "Toolbar" + "Dynamic variables"). Props:

```ts
interface OverlayCanvasProps {
  overlays: TextOverlay[];
  orientation: 'landscape' | 'portrait';
  variables: string[]; // from collectVariables(state)
  onChange: (overlays: TextOverlay[]) => void;
}
```

Requirements (keep each function ≤100 lines / ≤20 statements / complexity ≤15 — split into subcomponents `OverlayBox`, `OverlayToolbar`, `VariableMenu`; React Compiler on, NO useMemo/useCallback/memo; floated promises `.catch(()=>{})`; no `else`, `eqeqeq`, blank line before control-flow):

- A frame `div` with `aspect-video` (landscape) / `aspect-[9/16]` (portrait), measured via `ref` + `getBoundingClientRect()` for px↔fraction math.
- One `OverlayBox` per overlay positioned `left:${x*100}% top:${y*100}%` `translate(-50%,-50%)`, rendered with `fontFamily: findFont(font)?.cssFamily`, `fontSize: previewFontPx(fontsize, boxH, orientation)`, `color: fontcolor`, and a padded background `boxcolor` when `box`. Shows the raw text (incl. `{{ }}` tokens) or a "Double-click to edit" placeholder.
- Selection state (active index) in `OverlayCanvas`; click selects, click empty frame deselects. Selected box shows an outline + 4 corner handles.
- Pointer-drag body → move (`clampFraction`); pointer-drag a corner handle → `fontSizeFromPreview`; both `stopPropagation` so the section card's grip-drag never arms. Arrow keys nudge the selected box 2% when not editing.
- Double-click → inline `<textarea>` over the box; commit on blur/Enter; supports multiline + `{{ }}`.
- Docked `OverlayToolbar` below the frame for the selected overlay: Font `<select>` (FONTS), Size slider (8–300) + value, Color `ColorPicker`, Box checkbox → Box-color `ColorPicker`, a `VariableMenu` ("Insert variable ▾" listing `variables`, inserts `{{ name }}` at the textarea caret — disabled when `variables.length===0`), and a Delete button. Hidden/hinted when nothing selected.
- "+ Add text" appends `newOverlay()` at center, selects it, opens edit.

- [ ] **Step 4: Wire into `TemplateEditor.tsx`.**
  - Video branch of `SectionFields`: replace the old overlay form-rows + `TextPositioner` with `<OverlayCanvas overlays={section.overlays} orientation={orientation} variables={collectVariables(state)} onChange={(overlays) => onChange({ overlays })} />`. Thread `state` (or the computed `variables`) down to `SectionFields` as needed.
  - `MetadataFields`: add a **Global variables** editor — a list of `{name,value}` rows (text inputs) with add/remove, bound to `state.globalVariables` via `patch`. A short helper line "Reusable values you can insert as {{ name }} in text."
  - Remove the now-dead `OverlayEditor`/`OverlayStyleFields` and the `TextPositioner` import if unused (delete `TextPositioner.tsx` only if nothing references it).

- [ ] **Step 5: Verify.**
  - `pnpm --filter leclap exec vitest run` → all pass (geometry + model).
  - `pnpm lint 2>&1 | grep -iE "OverlayCanvas|overlayGeometry|admin/TemplateEditor|admin/templateEditorModel"` → empty.
  - `pnpm --filter leclap build` → success.
  - Manual: dev server → Create template → video section → add/drag/resize/edit text, switch fonts (real face renders), toggle box, add a Form section + a global variable, Insert variable ▾ inserts `{{ name }}`.

- [ ] **Step 6: No commit** — leave changes in the working tree.

---

## Self-review (plan vs spec)

- Canva canvas (move/select/inline-edit/resize+slider) → C3. ✓
- 6 bundled fonts + copy + @font-face + preload + per-overlay fontfile → C1 + C2. ✓
- Form-field ∪ global variables + Insert menu + global-vars editor → C2 (`collectVariables`, `globalVariables`) + C3. ✓
- WYSIWYG sizing via reference height → C3 `overlayGeometry`. ✓
- Testing (model round-trip, fonts integrity, geometry helpers; canvas build/manual) → covered. ✓
- Type consistency: `TextOverlay.font`, `FontEntry`, `collectVariables`, `globalVariables`, `previewFontPx`/`fontSizeFromPreview` used consistently across C1–C3. ✓
- Out of scope: Expo mirror — not in any task (deferred per spec). ✓
