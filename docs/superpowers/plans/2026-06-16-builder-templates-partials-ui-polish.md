# Builder / Templates / Partials UI-UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **On start, copy this plan to `docs/superpowers/plans/2026-06-16-builder-templates-partials-ui-polish.md`** (plan was authored in plan mode where only the scratch plan file was writable).

**Goal:** A system-reusing UI/UX polish of the three authoring surfaces in `apps/leclap-web` — Templates (discovery), Builder (flow), Partials (editor) — adding generated poster cards, search/filter, clearer hierarchy, real empty/loading states, and form/validation feedback.

**Architecture:** Pure logic (poster seeding, template filtering, section grouping) is extracted into small tested helpers under `src/lib/`; presentational changes reuse existing primitives (`Badge`, `Card`, `Button`, `Input`, `Select`, `Reveal`, `hover-pop`/`lift`/`tap`, `shimmer`, `brand-gradient`) and the existing token system — **no new tokens or gradients**. Ship area-by-area; the app stays working after each area.

**Tech Stack:** React 19, Vite, Tailwind v4 (`@theme`/`@utility`), `class-variance-authority`, `react-i18next`, `vitest`, lucide-react.

**Conventions (enforced):** no `eslint-disable`; no `else`/`else if` (guard clauses); all UI copy via `t()` + locale JSON (no hardcoded strings); light **and** dark must both work; respect `prefers-reduced-motion`. `pnpm lint` + `pnpm --filter @leclap/web exec tsc --noEmit` clean per task. **No commit without consent** — every "commit" step means _ask the user, then commit if approved_.

---

## File map (decomposition)

- `src/lib/poster.ts` — **new.** `hashHue(seed)` + `coverGradient(seed)` (lifted from `MediaPicker.tsx`) + `templatePoster(descriptor)`. One home for deterministic seeded visuals.
- `src/lib/sectionMeta.ts` — **new.** `SectionKind` icon map (lifted from `SceneList.tsx`'s `SectionIcon`) + `SECTION_CATEGORY` grouping (clip-visual / input / data). Reused by the poster glyph strip **and** the add-section palette.
- `src/lib/filterTemplates.ts` — **new.** Pure `filterTemplates(templates, facets)` predicate.
- `src/presentation/components/TemplateSearchBar.tsx` — **new.** Search input + facet chips.
- `src/presentation/components/EmptyState.tsx` — **new.** Reusable icon + title + hint + optional action (used by templates no-results and partials empty).
- Modify: `TemplateSelector.tsx`, `admin/MediaPicker.tsx` (re-point to `lib/poster`), `builder/SectionHub.tsx`, `ProgressDisplay.tsx`, `TemplateForm.tsx`, `ExportPanel.tsx`, `admin/PartialsEditor.tsx`, `admin/editor/SectionFields/PartialFields.tsx`, `admin/editor/SceneList.tsx`.
- i18n: add keys under the existing `src/i18n/locales/en/*` namespace used by each surface (find with `grep -rn "useTranslation\|i18nKey" <component>`), and mirror into other locales' index if present.

---

## AREA 1 — Templates (discovery)

### Task 1: `lib/poster.ts` — deterministic poster (TDD)

**Files:**

- Create: `apps/leclap-web/src/lib/poster.ts`
- Create: `apps/leclap-web/src/lib/poster.test.ts`
- Modify (after): `apps/leclap-web/src/presentation/components/admin/MediaPicker.tsx` (re-point its local `coverGradient`)

- [ ] **Step 1: Write failing tests**

```ts
// poster.test.ts
import { describe, it, expect } from 'vitest';
import { coverGradient, templatePoster } from './poster';

describe('coverGradient', () => {
  it('is deterministic for the same seed', () => {
    expect(coverGradient('arcadia')).toBe(coverGradient('arcadia'));
  });
  it('differs across seeds', () => {
    expect(coverGradient('a')).not.toBe(coverGradient('b'));
  });
});

describe('templatePoster', () => {
  it('caps glyphs at 5 and preserves order', () => {
    const sections = Array.from({ length: 8 }, () => ({ type: 'project_video' }));
    const p = templatePoster('id', { sections } as never);
    expect(p.glyphs).toHaveLength(5);
  });
  it('handles a descriptor with no sections', () => {
    const p = templatePoster('id', { sections: undefined } as never);
    expect(p.glyphs).toEqual([]);
    expect(typeof p.gradient).toBe('string');
  });
  it('maps section types to kinds', () => {
    const p = templatePoster('id', { sections: [{ type: 'form' }, { type: 'project_video' }] } as never);
    expect(p.glyphs).toEqual(['form', 'video']);
  });
});
```

- [ ] **Step 2: Run, verify fail**
      Run: `pnpm --filter @leclap/web exec vitest run src/lib/poster.test.ts`
      Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (copy the existing hash from `MediaPicker.tsx`'s `coverGradient`; map section `type` → `SectionKind` from `lib/sectionMeta` once Task 13 lands — for now inline a local `typeToKind`):

```ts
// poster.ts
import type { TemplateDescriptor } from '@/services/templateService';
import type { SectionKind } from './sectionMeta';

const hashHue = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
};

export const coverGradient = (seed: string): string => {
  const h = hashHue(seed);
  return `linear-gradient(135deg, oklch(0.7 0.13 ${h}), oklch(0.74 0.15 ${(h + 40) % 360}))`;
};

const typeToKind = (type?: string): SectionKind => {
  if (type === 'form') return 'form';
  if (type === 'color_background') return 'color';
  if (type === 'music') return 'music';
  if (type === 'image') return 'image';
  if (type === 'partial') return 'partial';
  return 'video';
};

export const templatePoster = (id: string, descriptor: TemplateDescriptor) => ({
  gradient: coverGradient(id),
  glyphs: (descriptor.sections ?? []).slice(0, 5).map((s) => typeToKind((s as { type?: string }).type)),
});
```

- [ ] **Step 4: Run, verify pass.** `pnpm --filter @leclap/web exec vitest run src/lib/poster.test.ts` → PASS.
- [ ] **Step 5: DRY** — replace `MediaPicker.tsx`'s local `coverGradient` with `import { coverGradient } from '@/lib/poster'`; run `tsc --noEmit`.
- [ ] **Step 6: Commit** (ask first): `feat(web): seeded poster helper for templates`.

### Task 2: `lib/sectionMeta.ts` — icon + category maps (TDD the grouping)

**Files:**

- Create: `apps/leclap-web/src/lib/sectionMeta.ts`
- Create: `apps/leclap-web/src/lib/sectionMeta.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SECTION_CATEGORY, SECTION_KINDS } from './sectionMeta';
it('assigns every kind to exactly one category', () => {
  for (const k of SECTION_KINDS) expect(SECTION_CATEGORY[k]).toBeTruthy();
});
it('groups clip & visuals together', () => {
  expect(SECTION_CATEGORY.video).toBe('clip');
  expect(SECTION_CATEGORY.color).toBe('clip');
  expect(SECTION_CATEGORY.image).toBe('clip');
  expect(SECTION_CATEGORY.form).toBe('input');
  expect(SECTION_CATEGORY.music).toBe('data');
  expect(SECTION_CATEGORY.partial).toBe('data');
});
```

- [ ] **Step 2: Verify fail.** `vitest run src/lib/sectionMeta.test.ts`.
- [ ] **Step 3: Implement** — export `SectionKind` union, `SECTION_KINDS` array, an `Icon` map (lift the lucide icons from `SceneList.tsx`'s `SectionIcon`), and `SECTION_CATEGORY: Record<SectionKind, 'clip'|'input'|'data'>`.
- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** (ask first): `refactor(web): shared section icon + category map`.

### Task 3: `lib/filterTemplates.ts` (TDD)

**Files:** Create `filterTemplates.ts` + `filterTemplates.test.ts`.

- [ ] **Step 1: Failing test** — covers: empty query returns all; query matches name OR description case-insensitively; `orientation`/`complexity` `'all'` is a no-op; facet equality filters; combined facets AND together.

```ts
const t = (over: Partial<Template>): Template => ({
  id: 'x',
  name: '',
  description: '',
  orientation: 'landscape',
  hasForm: false,
  complexity: 'simple',
  source: 'sample',
  descriptor: {},
  ...over,
});
it('matches name or description, case-insensitive', () => {
  const list = [t({ name: 'Spotlight' }), t({ description: 'a Flash intro' })];
  expect(filterTemplates(list, { query: 'flash', orientation: 'all', complexity: 'all' })).toHaveLength(1);
});
```

- [ ] **Step 2-4:** verify fail → implement pure predicate (guard clauses, no `else`) → verify pass.
- [ ] **Step 5: Commit** (ask first): `feat(web): template filter predicate`.

### Task 4: `TemplateSearchBar` + `EmptyState` components

**Files:** Create `TemplateSearchBar.tsx`, `EmptyState.tsx`.

- [ ] **Step 1:** `EmptyState({ icon, title, hint, action })` — centered, uses `Card`/muted text + optional `Button variant="ghost"`. All text passed in (caller supplies `t()` strings).
- [ ] **Step 2:** `TemplateSearchBar({ query, onQuery, orientation, complexity, onFacet })` — an `Input` with a `Search` icon for `query`, plus facet chips reusing the segmented look from `MediaPicker`'s tab bar (`inline-flex rounded-lg bg-foreground/5 p-0.5`); chips: All/Portrait/Landscape and All/Simple/Intermediate/Advanced; active chip `bg-surface text-foreground shadow-sm`. Copy via `t('templates.search.*')`.
- [ ] **Step 3:** `tsc --noEmit` clean.
- [ ] **Step 4: Commit** (ask first): `feat(web): template search bar + empty state`.

### Task 5: Poster cards + wire search/filter into `TemplateSelector`

**Files:** Modify `apps/leclap-web/src/presentation/components/TemplateSelector.tsx` (cards 36–147, grid 217–230, skeleton 149–155).

- [ ] **Step 1:** Add `query`/`orientation`/`complexity` state; render `<TemplateSearchBar/>` above the grid; compute `const shown = filterTemplates(templates, { query, orientation, complexity })`; map over `shown`.
- [ ] **Step 2:** Give `TemplateCard` a **poster header**: a band `style={{ backgroundImage: templatePoster(template.id, template.descriptor).gradient }}` with the glyph strip (`SECTION_KINDS` icons from `lib/sectionMeta`, white/80 on the band, capped 5) and the existing selection checkmark overlaid; name + description + `CardMetaChips` below; wrap the card root in `lift` (keep the selected ring + `aria-pressed`).
- [ ] **Step 3:** Replace `LoadingSkeleton` blocks to match the new shape (poster band + 2 text lines) using `shimmer`. Add a **no-results** branch: when `shown.length === 0 && templates.length > 0`, render `<EmptyState icon={SearchX} title={t('templates.empty.title')} hint={t('templates.empty.hint')} action={{ label: t('templates.empty.clear'), onClick: resetFacets }} />`.
- [ ] **Step 4: Verify** — `pnpm playground:web`, /builder template step: search narrows; chips filter; clearing restores; posters render in light+dark; selecting works; reduced-motion respected. `tsc` + `lint` clean.
- [ ] **Step 5: Commit** (ask first): `feat(web): poster template cards with search + filters`.

---

## AREA 2 — Builder (flow)

### Task 6: `SectionHub` hierarchy + "Next" affordance

**Files:** Modify `apps/leclap-web/src/presentation/components/builder/SectionHub.tsx` (HubRow 68–121, progress card 560–683).

- [ ] **Step 1:** Compute `nextIndex` = first incomplete section index. Pass `isNext` to the matching `HubRow`.
- [ ] **Step 2:** Differentiate surfaces — keep the progress `Card` as `glass-panel-dark`; change `HubRow` base to a lighter `bg-surface/40 border-foreground/10` (not nested glass). Done rows keep `border-success/30 bg-success/[0.06]`. The `isNext` row gets a `brand-gradient` left accent bar + a small `Badge variant="brand"` reading `t('hub.next')`.
- [ ] **Step 3:** Allow titles to wrap (`line-clamp-2`, remove single-line truncation); keep numbered→`Check` swap; keep staggered fade-in.
- [ ] **Step 4: Verify** — hub shows exactly one "Next"; rows read distinctly from the card; long titles wrap; light+dark. `tsc`+`lint`.
- [ ] **Step 5: Commit** (ask first): `feat(web): builder hub hierarchy + next-step cue`.

### Task 7: `SectionSheet` desktop scrim + drag handle

**Files:** Modify `SectionHub.tsx` (`SectionSheet` 366–524).

- [ ] **Step 1:** Render the scrim (`bg-black/40 backdrop-blur-sm`) on **all** breakpoints (today mobile-only); click-scrim closes; keep `z` below the sheet.
- [ ] **Step 2:** Add a visible grab handle (`mx-auto h-1.5 w-10 rounded-full bg-foreground/20`) at the sheet top on mobile; keep drag-to-dismiss but also translate the sheet with the drag (not opacity-only).
- [ ] **Step 3: Verify** — desktop side sheet now has a dimmed backdrop; mobile sheet shows the handle and follows the finger; ESC/scrim/close all dismiss. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): focused section sheet (desktop scrim + drag handle)`.

### Task 8: `ProgressDisplay` motion diet + responsive steps

**Files:** Modify `apps/leclap-web/src/presentation/components/ProgressDisplay.tsx` (ProgressBar 217–258, step row 265–299).

- [ ] **Step 1:** Keep the brand-gradient fill animation; remove the competing animated background-gradient pan (keep a single shimmer OR none) so only one motion reads at a time.
- [ ] **Step 2:** Make the StepIndicator row wrap on narrow widths (`flex-wrap gap-y-2`) instead of horizontal overflow; condense connectors when wrapped.
- [ ] **Step 3: Verify** — compile a template; progress bar reads calm (no motion pile-up); narrow the window → step circles wrap, no overflow; `prefers-reduced-motion` stops the bar animation. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `fix(web): calmer, responsive compile progress`.

### Task 9: `TemplateForm` counter + inline/required validation

**Files:** Modify `apps/leclap-web/src/presentation/components/TemplateForm.tsx`.

- [ ] **Step 1:** For fields with `maxLength`, render a live counter `{{value.length}}/{{max}}` (muted, right-aligned under the field).
- [ ] **Step 2:** Mark required fields with a small `*` + `aria-required`; show the existing error inline as the user types (validate on `onChange`, not only blur), reusing `border-error/50 bg-error/10`.
- [ ] **Step 3: Verify** — typing updates the counter; required fields show the marker; clearing a required field shows the error live; screen reader announces invalid (`aria-invalid`). `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): form field counters + live validation`.

### Task 10: `ExportPanel` result hierarchy + "Copied!" flash

**Files:** Modify `apps/leclap-web/src/presentation/components/ExportPanel.tsx` (info cards 33–61, actions, success card).

- [ ] **Step 1:** Make the video preview the hero; demote file-size/format from full info cards to compact `Badge`-style meta inline under the preview.
- [ ] **Step 2:** Keep Download primary; on **Copy Link** success, flash a transient "Copied!" state on the button (swap label + a brief `pop-in`/checkmark for ~1.5s via a `useState` + timeout) instead of the tiny static label. Keep the privacy success card but as a secondary, lower-emphasis surface.
- [ ] **Step 3: Verify** — result screen reads preview-first; copying shows a clear flash; share still conditional on `navigator.share`. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): export result hierarchy + copied flash`.

---

## AREA 3 — Partials (editor)

### Task 11: `PartialsEditor` list item cards + empty state

**Files:** Modify `apps/leclap-web/src/presentation/components/admin/PartialsEditor.tsx` (sidebar 99–122).

- [ ] **Step 1:** Replace id-only buttons with a richer item: **id** (`text-sm font-semibold`) + one-line **description** (muted, `line-clamp-1`) + a `Badge` for source (`neutral` "Built-in" / `brand` "Local", via `t()`) + a section-count chip (`{{n}} sections`). Keep selected (`bg-brand-500/15`) and hover states + focus ring.
- [ ] **Step 2:** When the list has zero local partials, show `<EmptyState icon={Braces} title={t('partials.empty.title')} hint={t('partials.empty.hint')} />` above/below the New button.
- [ ] **Step 3: Verify** — items show description + source + count; selecting works; empty state shows for a fresh user-partial store; light+dark. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): richer partial list with source + counts`.

### Task 12: `PartialFields` summary badges + variable hints

**Files:** Modify `apps/leclap-web/src/presentation/components/admin/editor/SectionFields/PartialFields.tsx` (ref select 31–71, vars 73–119).

- [ ] **Step 1:** The selected-partial summary becomes `Badge`s: source (Built-in/Local), `{{n}} sections`, and the description below. Pull from the same partial record the `Select` lists.
- [ ] **Step 2:** Give the variables grid a header (`t('partials.vars.title')`) + helper line (`t('partials.vars.help')`), and `placeholder`s on the name/value inputs (`name`, `value`) so non-experts understand the mapping. Keep add/remove.
- [ ] **Step 3: Verify** — choosing a partial shows the badges + description; variables read as an intentional table with hints. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): clearer partial insert summary + variable hints`.

### Task 13: `SceneList` grouped add-section palette

**Files:** Modify `apps/leclap-web/src/presentation/components/admin/editor/SceneList.tsx` (add buttons 422–463); reuse `lib/sectionMeta`.

- [ ] **Step 1:** Replace the local `SectionIcon` with `Icon` from `lib/sectionMeta` (DRY with Task 2).
- [ ] **Step 2:** Group the six add-section buttons under quiet category labels using `SECTION_CATEGORY`: **Clip & visuals** (video/color/image), **Input** (form), **Data** (music/partial). Each group = a small `t()` label + the existing 2-col button grid (keep `lift`/hover + `SectionIcon` badges).
- [ ] **Step 3: Verify** — add-section palette reads as grouped, intentional choices; adding each type still works; icons consistent with cards/posters. `tsc`+`lint`.
- [ ] **Step 4: Commit** (ask first): `feat(web): grouped add-section palette`.

---

## Verification (end-to-end)

1. `pnpm --filter @leclap/web exec vitest run src/lib/` → poster, sectionMeta, filterTemplates pass.
2. `pnpm --filter @leclap/web exec tsc --noEmit` → clean. `pnpm lint` → clean (no eslint-disable, no `else`, no hardcoded UI strings).
3. `pnpm playground:web`, walk each surface in **light and dark**:
   - **Templates:** search + facet chips narrow the poster grid; clearing restores; no-results empty state; cards show posters + glyphs + `lift`; selection works.
   - **Builder:** hub shows one "Next" cue with distinct row surfaces; section sheet has a desktop backdrop + mobile drag handle; compile progress is calm and the step row wraps on narrow widths; form fields show counters + live/required validation; result is preview-first with a "Copied!" flash.
   - **Partials:** list items show description + source badge + section count + empty state; partial insert shows a clear summary + variable hints; add-section palette is grouped.
4. Keyboard tab order + focus rings on templates/partials/add-buttons; `prefers-reduced-motion` disables entrance + progress animations.

## Notes

- Ships area-by-area; the app is fully working after each area's commit. No backend/template-schema changes — purely presentation + 3 pure helpers.
- Helpers (`lib/poster.ts`, `lib/sectionMeta.ts`, `lib/filterTemplates.ts`) are the only TDD targets; JSX is verified manually + by `tsc`/`lint`.
- **No commit without consent:** every commit step = ask, then commit. Conventional, lowercase, short subject, no body, no Claude trailer (repo style).
