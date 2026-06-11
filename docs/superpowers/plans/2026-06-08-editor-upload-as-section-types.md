# Editor Upload-as-Section-Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "Let viewers upload their own track/image" checkboxes in the template editor with first-class `usermusic` and `userphoto` section types that appear alongside "Your video", "Color background" in the section list.

**Architecture:** The `EditorSection` union grows two new members (`usermusic`, `userphoto`). `buildDescriptor` derives `global.allowUploadMusic`/`global.allowUploadBackground` from the presence of those sections rather than from removed `EditorState` boolean fields. `toEditorState` rehydrates those sections from the stored globals on round-trip. The Builder and compile pipeline are untouched — they continue consuming the same `global.*` flags.

**Tech Stack:** TypeScript, React 19 (React Compiler active — no useMemo/useCallback/memo), Vitest, oxlint, pnpm workspaces (filter name `leclap`), lucide-react icons.

---

## Files modified (no new files)

| File                                                                             | Change                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/leclap-web/src/presentation/components/admin/templateEditorModel.ts`      | Remove `allowUploadMusic`/`allowUploadBackground` from `EditorState`; add `usermusic`/`userphoto` to `EditorSection`; update `SECTION_LABELS`, `newSection`, `buildDescriptor`, `toEditorState` |
| `apps/leclap-web/src/presentation/components/admin/TemplateEditor.tsx`          | Remove upload checkboxes; add `usermusic`/`userphoto` to `AddSectionButtons`; add icon cases to `SectionIcon`; add field branches to `SectionFields`; fix `handleSave` guard                    |
| `apps/leclap-web/src/presentation/components/admin/templateEditorModel.test.ts` | Update `baseState` helper; replace `allowUploadMusic`/`allowUploadBackground` tests with section-driven tests; add round-trip tests for new kinds                                               |

---

### Task 1: Update `templateEditorModel.ts` — types and section factory

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.ts:1-39`

- [ ] **Step 1: Extend `EditorSection` union and remove upload booleans from `EditorState`**

Replace the current `EditorSection` type and `EditorState` interface with:

```typescript
export type EditorSection =
  | { kind: 'form'; fields: FormField[] }
  | { kind: 'video'; duration: number; mute: boolean; text: string; fontsize: number; fontcolor: string }
  | { kind: 'color'; duration: number; color: string }
  | { kind: 'usermusic' }
  | { kind: 'userphoto'; duration: number };

export interface EditorState {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  musicEnabled: boolean;
  allowedMusic: string[];
  backgroundEnabled: boolean;
  allowedBackgrounds: string[];
  sections: EditorSection[];
}
```

- [ ] **Step 2: Extend `SECTION_LABELS` and `newSection`**

Replace:

```typescript
export const SECTION_LABELS: Record<EditorSection['kind'], string> = {
  form: 'Form fields',
  video: 'Your video',
  color: 'Color background',
  usermusic: 'Your music',
  userphoto: 'Your photo',
};

export function newSection(kind: EditorSection['kind']): EditorSection {
  if (kind === 'form') return { kind: 'form', fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }] };

  if (kind === 'color') return { kind: 'color', duration: 3, color: '#7C83FD' };

  if (kind === 'usermusic') return { kind: 'usermusic' };

  if (kind === 'userphoto') return { kind: 'userphoto', duration: 4 };

  return { kind: 'video', duration: 8, mute: false, text: '', fontsize: 48, fontcolor: '#ffffff' };
}
```

---

### Task 2: Update `buildDescriptor` in `templateEditorModel.ts`

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.ts:51-123`

- [ ] **Step 1: Rewrite `buildDescriptor`**

Replace the existing `buildDescriptor` function body so that:

- `usermusic`/`userphoto` sections are skipped in `editorSections.map` (they do not emit descriptor sections).
- `hasUserMusic` and `userPhoto` drive the global flags.
- `background_1` placeholder is emitted when `state.backgroundEnabled || userPhoto != null`.
- `musicEnabled` in global is true when `state.musicEnabled || hasUserMusic`.

```typescript
export function buildDescriptor(state: EditorState): TemplateDescriptor {
  let videoIndex = 0;

  const hasUserMusic = state.sections.some((s) => s.kind === 'usermusic');
  const userPhoto = state.sections.find((s): s is { kind: 'userphoto'; duration: number } => s.kind === 'userphoto');

  const editorSections = state.sections
    .filter((s) => s.kind !== 'usermusic' && s.kind !== 'userphoto')
    .map((section, i): NonNullable<TemplateDescriptor['sections']>[number] => {
      if (section.kind === 'form') {
        return {
          name: `form_${i + 1}`,
          type: 'form',
          options: {
            fields: section.fields.map((f) => ({ name: f.name, maxLength: f.maxLength, label: { en: f.label } })),
          },
        };
      }

      if (section.kind === 'color') {
        return {
          name: `color_${i + 1}`,
          type: 'color_background',
          options: { duration: section.duration, backgroundColor: section.color },
        };
      }

      videoIndex += 1;
      const filters = section.text.trim()
        ? [
            {
              type: 'drawtext',
              values: {
                text: { en: section.text },
                fontsize: section.fontsize,
                fontcolor: section.fontcolor,
                fontfile: 'Rubik.ttf',
                x: '(w-text_w)/2',
                y: '(h-text_h)/2',
              },
            },
          ]
        : undefined;

      return {
        name: `video_${videoIndex}`,
        type: 'project_video',
        options: { duration: section.duration, muteSection: section.mute },
        ...(filters ? { filters } : {}),
      };
    });

  const needsBackground = state.backgroundEnabled || userPhoto != null;
  const backgroundDuration = userPhoto?.duration ?? 4;

  const backgroundSections: NonNullable<TemplateDescriptor['sections']>[number][] = needsBackground
    ? [{ name: 'background_1', type: 'image_background', options: { duration: backgroundDuration } }]
    : [];

  const sections = [...editorSections, ...backgroundSections];

  const global: NonNullable<TemplateDescriptor['global']> = {
    orientation: state.orientation,
    musicEnabled: state.musicEnabled || hasUserMusic,
    transitionDuration: 0.5,
  };

  if (state.musicEnabled || hasUserMusic) {
    global.allowedMusic = state.allowedMusic;
    if (hasUserMusic) global.allowUploadMusic = true;
  }

  if (needsBackground) {
    global.allowedBackgrounds = state.allowedBackgrounds;
    if (userPhoto != null) global.allowUploadBackground = true;
  }

  return { global, sections };
}
```

---

### Task 3: Update `toEditorState` in `templateEditorModel.ts`

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.ts:168-211`

- [ ] **Step 1: Rewrite `toEditorState`**

The new rules:

- Null template returns blank state without `allowUploadMusic`/`allowUploadBackground` fields.
- `musicEnabled` is derived from `(g?.allowedMusic?.length ?? 0) > 0` (shortlist-driven), `allowedMusic = g?.allowedMusic ?? []`.
- `backgroundEnabled` is derived from `(g?.allowedBackgrounds?.length ?? 0) > 0 || storedSections.some(s => s.type === 'image_background')`.
- If `g?.allowUploadMusic` → append `{ kind: 'usermusic' }` to editor sections.
- If `g?.allowUploadBackground` → append `{ kind: 'userphoto', duration: <from image_background section or 4> }`.
- `image_background` stored sections continue to be skipped by `storedSectionToEditor` (already the case).

```typescript
export function toEditorState(template: Template | null): EditorState {
  if (!template) {
    return {
      id: makeTemplateId(),
      name: '',
      description: '',
      orientation: 'landscape',
      musicEnabled: false,
      allowedMusic: [],
      backgroundEnabled: false,
      allowedBackgrounds: [],
      sections: [newSection('video')],
    };
  }

  const { global: g, sections: storedSections = [] } = template.descriptor;

  const musicEnabled = (g?.allowedMusic?.length ?? 0) > 0;
  const allowedMusic = g?.allowedMusic ?? [];

  const allowedBackgrounds = g?.allowedBackgrounds ?? [];
  const backgroundEnabled = allowedBackgrounds.length > 0 || storedSections.some((s) => s.type === 'image_background');

  const bgSection = storedSections.find((s) => s.type === 'image_background');
  const bgDuration = bgSection?.options?.duration ?? 4;

  const mapped = storedSections.map(storedSectionToEditor).filter((s): s is EditorSection => s !== null);

  if (g?.allowUploadMusic) mapped.push({ kind: 'usermusic' });

  if (g?.allowUploadBackground) mapped.push({ kind: 'userphoto', duration: bgDuration });

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    orientation: template.orientation,
    musicEnabled,
    allowedMusic,
    backgroundEnabled,
    allowedBackgrounds,
    sections: mapped.length > 0 ? mapped : [newSection('video')],
  };
}
```

---

### Task 4: Update the test file

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/templateEditorModel.test.ts`

- [ ] **Step 1: Rewrite `baseState` to remove deleted fields**

```typescript
function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    musicEnabled: false,
    allowedMusic: [],
    backgroundEnabled: false,
    allowedBackgrounds: [],
    sections: [newSection('video')],
    ...over,
  };
}
```

- [ ] **Step 2: Replace music-shortlist tests**

Replace the `'templateEditorModel — music shortlist'` describe block with:

```typescript
describe('templateEditorModel — music shortlist', () => {
  it('emits global.allowedMusic when musicEnabled with a shortlist', () => {
    const d = buildDescriptor(baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id] }));

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1.id, music2.id]);
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });

  it('emits allowUploadMusic:true when a usermusic section is present', () => {
    const d = buildDescriptor(baseState({ sections: [newSection('video'), newSection('usermusic')] }));

    expect(d.global?.allowUploadMusic).toBe(true);
    expect(d.global?.musicEnabled).toBe(true);
  });

  it('omits allowedMusic and allowUploadMusic when musicEnabled:false and no usermusic section', () => {
    const d = buildDescriptor(baseState({ musicEnabled: false, allowedMusic: [music1.id] }));

    expect(d.global?.allowedMusic).toBeUndefined();
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });
});
```

- [ ] **Step 3: Replace background-shortlist tests**

Replace the `'templateEditorModel — background shortlist'` describe block with:

```typescript
describe('templateEditorModel — background shortlist', () => {
  it('emits global.allowedBackgrounds when backgroundEnabled with a shortlist', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id, bg2.id] }));

    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    expect(d.global?.allowUploadBackground).toBeUndefined();
  });

  it('appends a background_1 placeholder when backgroundEnabled', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id] }));

    const bgSection = d.sections?.find((s) => s.name === 'background_1');

    expect(bgSection).toMatchObject({ name: 'background_1', type: 'image_background', options: { duration: 4 } });
    expect((bgSection?.options as { pictureUrl?: string } | undefined)?.pictureUrl).toBeUndefined();
  });

  it('emits allowUploadBackground:true when a userphoto section is present', () => {
    const d = buildDescriptor(baseState({ sections: [newSection('video'), newSection('userphoto')] }));

    expect(d.global?.allowUploadBackground).toBe(true);
    // also emits the background_1 placeholder with the section's duration
    const bgSection = d.sections?.find((s) => s.name === 'background_1');
    expect(bgSection).toMatchObject({ name: 'background_1', type: 'image_background', options: { duration: 4 } });
  });

  it('userphoto section duration is used in background_1 placeholder', () => {
    const d = buildDescriptor(baseState({ sections: [{ kind: 'userphoto', duration: 7 }] }));

    const bgSection = d.sections?.find((s) => s.name === 'background_1');
    expect(bgSection?.options?.duration).toBe(7);
  });

  it('omits allowedBackgrounds and background_1 when backgroundEnabled:false and no userphoto section', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: false, allowedBackgrounds: [bg1.id] }));

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});
```

- [ ] **Step 4: Replace round-trip tests**

Replace the `'templateEditorModel — round-trips'` describe block with:

```typescript
describe('templateEditorModel — round-trips', () => {
  it('round-trips musicEnabled + allowedMusic through a stored template', () => {
    const start = baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id] });
    const back = toEditorState(asTemplate(start));

    expect(back.musicEnabled).toBe(true);
    expect(back.allowedMusic).toEqual([music1.id, music2.id]);
    expect(back.sections.some((s) => s.kind === 'usermusic')).toBe(false);
  });

  it('round-trips a usermusic section: allowUploadMusic → usermusic section reappears', () => {
    const start = baseState({ sections: [newSection('video'), newSection('usermusic')] });
    const back = toEditorState(asTemplate(start));

    expect(back.sections.some((s) => s.kind === 'usermusic')).toBe(true);
    expect(back.sections.every((s) => s.kind !== 'userphoto')).toBe(true);
  });

  it('round-trips backgroundEnabled + allowedBackgrounds through a stored template', () => {
    const start = baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id] });
    const back = toEditorState(asTemplate(start));

    expect(back.backgroundEnabled).toBe(true);
    expect(back.allowedBackgrounds).toEqual([bg1.id]);
    expect(back.sections.some((s) => s.kind === 'userphoto')).toBe(false);
    expect(back.sections.some((s) => s.kind === ('image' as string))).toBe(false);
  });

  it('round-trips a userphoto section: allowUploadBackground → userphoto section reappears', () => {
    const start = baseState({ sections: [newSection('video'), { kind: 'userphoto', duration: 6 }] });
    const back = toEditorState(asTemplate(start));

    const userphoto = back.sections.find((s) => s.kind === 'userphoto');
    expect(userphoto).toBeDefined();
    expect((userphoto as { kind: 'userphoto'; duration: number } | undefined)?.duration).toBe(6);
    expect(back.sections.every((s) => s.kind !== ('image' as string))).toBe(true);
  });

  it('detects backgroundEnabled from a legacy stored template with an image_background section', () => {
    const legacyDescriptor = {
      global: { orientation: 'landscape' as const, musicEnabled: false },
      sections: [
        { name: 'video_1', type: 'project_video' as const, options: { duration: 8 } },
        {
          name: 'image_1',
          type: 'image_background' as const,
          options: { duration: 4, pictureUrl: '/backgrounds/forest-sea.jpg' },
        },
      ],
    };
    const template: Template = {
      id: 'legacy-1',
      name: 'Legacy',
      description: '',
      orientation: 'landscape',
      hasForm: false,
      complexity: 'simple',
      source: 'user',
      descriptor: legacyDescriptor,
    };
    const state = toEditorState(template);

    expect(state.backgroundEnabled).toBe(true);
    expect(state.sections.every((s) => s.kind !== ('image' as string))).toBe(true);
    expect(state.sections.some((s) => s.kind === 'video')).toBe(true);
  });

  it('toEditorState returns a blank state for null template', () => {
    const state = toEditorState(null);

    expect(state.musicEnabled).toBe(false);
    expect(state.allowedMusic).toEqual([]);
    expect(state.backgroundEnabled).toBe(false);
    expect(state.allowedBackgrounds).toEqual([]);
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].kind).toBe('video');
  });
});
```

- [ ] **Step 5: Run vitest to confirm tests fail as expected (model not yet updated)**

```bash
pnpm --filter leclap exec vitest run
```

Expected: TypeScript errors or test failures because `EditorState` still has old shape in the test helpers.

---

### Task 5: Apply model changes (Tasks 1–3) — run tests green

- [ ] **Step 1: Apply all three model edits from Tasks 1, 2, 3 to `templateEditorModel.ts`**

The final file must compile cleanly. Key invariants to check:

- `EditorSection` union: 5 members — `form`, `video`, `color`, `usermusic`, `userphoto`.
- `EditorState` has NO `allowUploadMusic` / `allowUploadBackground` fields.
- `SECTION_LABELS` has all 5 keys.
- `newSection` handles all 5 kinds.
- `buildDescriptor` skips `usermusic`/`userphoto` in the loop (use `.filter` before `.map`); derives globals from presence.
- `toEditorState(null)` returns state without `allowUploadMusic`/`allowUploadBackground`.
- `toEditorState(template)` pushes `usermusic`/`userphoto` editor sections from `g.allowUploadMusic`/`g.allowUploadBackground`.

- [ ] **Step 2: Run vitest**

```bash
pnpm --filter leclap exec vitest run
```

Expected: All tests in `templateEditorModel.test.ts` pass. (The UI file still imports `allowUploadMusic`/`allowUploadBackground` from state — TypeScript won't run until we fix it, but vitest type-checks on the fly.)

---

### Task 6: Update `TemplateEditor.tsx`

**Files:**

- Modify: `apps/leclap-web/src/presentation/components/admin/TemplateEditor.tsx`

- [ ] **Step 1: Update imports — add `Music` and `ImageIcon` from lucide-react**

In the import from `'lucide-react'`, add `Music` and `Image as ImageIcon`:

```typescript
import {
  GripVertical,
  Trash2,
  Plus,
  X,
  Type,
  Video as VideoIcon,
  Square,
  FileText,
  Save,
  ArrowDown,
  AlertCircle,
  Music,
  Image as ImageIcon,
} from 'lucide-react';
```

- [ ] **Step 2: Remove `allowUploadMusic`/`allowUploadBackground` from `handleSave` guard**

Change the two upload-related guard conditions:

```typescript
if (state.musicEnabled && state.allowedMusic.length === 0) {
  setError('Pick at least one music track or turn off background music.');

  return;
}

if (state.backgroundEnabled && state.allowedBackgrounds.length === 0) {
  setError('Pick at least one background image or turn off background image.');

  return;
}
```

(Remove the `&& !state.allowUploadMusic` / `&& !state.allowUploadBackground` conditions entirely since those fields no longer exist on state.)

- [ ] **Step 3: Remove upload checkboxes from `MetadataFields`**

In the Background-music panel, remove:

```tsx
<label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
  <Checkbox
    checked={state.allowUploadMusic}
    onCheckedChange={(c) => {
      patch({ allowUploadMusic: c === true });
    }}
  />
  Let viewers upload their own track
</label>
```

In the Background-image panel, remove:

```tsx
<label className="flex w-fit items-center gap-2 text-sm text-gray-700 cursor-pointer select-none dark:text-gray-200">
  <Checkbox
    checked={state.allowUploadBackground}
    onCheckedChange={(c) => {
      patch({ allowUploadBackground: c === true });
    }}
  />
  Let viewers upload their own image
</label>
```

Also remove `allowUploadMusic`/`allowUploadBackground` references from `MetadataFieldsProps` interface if they appear there (they are accessed via `state.*`; just `state` and `patch` are the props — those are unchanged).

- [ ] **Step 4: Add `usermusic` and `userphoto` to `AddSectionButtons`**

```tsx
const AddSectionButtons = ({ addSection }: { addSection: (kind: EditorSection['kind']) => void }) => (
  <div className="flex flex-wrap gap-2 mb-6">
    {(['video', 'form', 'color', 'usermusic', 'userphoto'] as const).map((kind) => (
      <button
        key={kind}
        type="button"
        onClick={() => {
          addSection(kind);
        }}
        className="tap inline-flex min-h-10 items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-foreground/10 bg-foreground/5 text-gray-700 hover:bg-foreground/10 hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-all dark:text-gray-200"
      >
        <Plus className="w-4 h-4" /> {SECTION_LABELS[kind]}
      </button>
    ))}
  </div>
);
```

- [ ] **Step 5: Add `usermusic`/`userphoto` cases to `SectionIcon`**

```tsx
const SectionIcon = ({ kind }: { kind: EditorSection['kind'] }) => {
  if (kind === 'form') return <FileText className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'color') return <Square className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  if (kind === 'usermusic') return <Music className="w-4 h-4 text-brand-700 dark:text-brand-300" />;

  if (kind === 'userphoto') return <ImageIcon className="w-4 h-4 text-secondary-700 dark:text-secondary-300" />;

  return <VideoIcon className="w-4 h-4 text-brand-700 dark:text-brand-300" />;
};
```

- [ ] **Step 6: Add `usermusic`/`userphoto` branches to `SectionFields`**

Insert before the fallthrough `// form` return:

```tsx
if (section.kind === 'usermusic') {
  return <p className="pl-7 text-sm text-gray-500 dark:text-gray-400">Viewers upload their own music track.</p>;
}

if (section.kind === 'userphoto') {
  return (
    <div className="grid sm:grid-cols-2 gap-3 pl-7">
      <NumberField
        label="Duration (s)"
        value={section.duration}
        onChange={(v) => {
          onChange({ duration: v });
        }}
        inputCls={inputCls}
      />
      <p className="sm:col-span-2 text-sm text-gray-500 dark:text-gray-400">Viewers upload their own photo.</p>
    </div>
  );
}
```

---

### Task 7: Verify — tests, lint, build

- [ ] **Step 1: Run vitest**

```bash
pnpm --filter leclap exec vitest run
```

Expected: All tests pass, no failures.

- [ ] **Step 2: Run lint check for the touched files**

```bash
pnpm lint 2>&1 | grep -iE "templateEditorModel|admin/TemplateEditor"
```

Expected: Empty output (no lint findings for those files).

If there are findings, the most likely oxlint rules to fix:

- `complexity` / `max-statements` in `buildDescriptor` — break out a helper like `buildMusicGlobal` / `buildBackgroundGlobal` if needed.
- `no-else-return` — remove `else` after `return`.
- `eqeqeq` — use `=== null` not `== null`.
- `max-lines` — keep each function focused; the model file should stay under ~220 lines after the changes.
- React Compiler: delete any `useMemo`/`useCallback`/`memo` if accidentally added.

- [ ] **Step 3: Run the web build**

```bash
pnpm --filter leclap build
```

Expected: Build succeeds with no TypeScript errors.

---

## Self-Review against spec

| Spec requirement                                                               | Covered                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| Remove `allowUploadMusic`/`allowUploadBackground` from `EditorState`           | Task 1 step 1                              |
| Add `usermusic` / `userphoto` to `EditorSection` union                         | Task 1 step 1                              |
| `SECTION_LABELS` entries                                                       | Task 1 step 2                              |
| `newSection` for new kinds                                                     | Task 1 step 2                              |
| `buildDescriptor`: derive `allowUploadMusic` from `usermusic` section          | Task 2                                     |
| `buildDescriptor`: derive `allowUploadBackground` from `userphoto` section     | Task 2                                     |
| `buildDescriptor`: single `background_1` placeholder, no duplicates            | Task 2                                     |
| `buildDescriptor`: `musicEnabled` true when `hasUserMusic`                     | Task 2                                     |
| `buildDescriptor`: `userphoto.duration` → `background_1.options.duration`      | Task 2                                     |
| `toEditorState`: `musicEnabled` from shortlist length                          | Task 3                                     |
| `toEditorState`: rehydrate `usermusic` section from `allowUploadMusic`         | Task 3                                     |
| `toEditorState`: rehydrate `userphoto` section from `allowUploadBackground`    | Task 3                                     |
| `toEditorState`: continue skipping `image_background` stored sections          | Task 3 (unchanged `storedSectionToEditor`) |
| `toEditorState(null)`: blank state without deleted fields                      | Task 3                                     |
| UI: remove upload checkboxes                                                   | Task 6 step 3                              |
| UI: add `usermusic`/`userphoto` to add-section buttons                         | Task 6 step 4                              |
| UI: `SectionIcon` for new kinds                                                | Task 6 step 5                              |
| UI: `SectionFields` for new kinds                                              | Task 6 step 6                              |
| UI: fix `handleSave` guard                                                     | Task 6 step 2                              |
| Tests: `usermusic` section → `allowUploadMusic === true` + `musicEnabled`      | Task 4 step 3                              |
| Tests: `userphoto` section → `allowUploadBackground === true` + `background_1` | Task 4 step 3                              |
| Tests: round-trip `allowUploadMusic` → `usermusic` section                     | Task 4 step 4                              |
| Tests: round-trip `allowUploadBackground` → `userphoto` section                | Task 4 step 4                              |
| Tests: keep `import { describe, it, expect } from 'vitest'`                    | Task 4 (retained)                          |
| Lint grep empty                                                                | Task 7 step 2                              |
| Build succeeds                                                                 | Task 7 step 3                              |
