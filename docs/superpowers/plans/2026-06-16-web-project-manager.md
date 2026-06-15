# Web Project Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **On start, copy this plan to `docs/superpowers/plans/2026-06-16-web-project-manager.md`** (plan was authored in plan mode where only the scratch plan file was writable).
>
> **For every UI task:** apply the `impeccable` (design critique) and `ui-ux-pro-max` skills, and the existing `frontend-design` guidance — same bar as the recent Builder/Templates polish. Reuse the design system; **no new tokens/gradients**.

## Context

The Expo app has a **project manager**: users build a video against a template (record clips, fill forms, pick music), and each in-progress build is a saved **Project** (status `draft` → `completed`) persisted in `AsyncStorage`, resumable from a Projects screen. The **web** app has no equivalent — `Builder.tsx`'s `useBuilderController` holds everything in `useState` (`EMPTY_MODEL`), so a refresh or navigation **loses all in-progress work**. There is no way to keep multiple builds, come back to a draft, or re-open a finished video.

This plan ports the concept to `apps/leclap-web`: a **Projects-only** manager (no background compile queue — web compile is synchronous WASM in-tab), with **full persistence** (clip blobs + completed output in IndexedDB so drafts truly resume and finished videos re-open without recompiling) and **auto-save** (debounced, matching Expo). Outcome: a `/projects` page listing draft + completed projects with resume / view / delete, and a Builder that auto-saves to and hydrates from those projects.

**Decisions (locked with user):** Projects only · Full IndexedDB persistence · Auto-save.

**Tech stack:** React 19, Vite, react-router v7, Tailwind v4, vitest, lucide-react, i18next. Zustand is installed but **unused** — we follow the existing **injectable-service** pattern instead (no new global store), matching `UserTemplateService`/`browserMediaService`.

---

## Architecture & reuse

Two storage layers, mirroring patterns already in the repo:

- **Metadata → localStorage.** A `UserProjectService` modeled exactly on `src/stores/userTemplateStore.ts` (injectable `Storage`, `list/get/save/remove`, `defaultMakeId`, best-effort quota handling). Key `leclap.projects`.
- **Blobs → IndexedDB.** A dedicated blob store modeled exactly on `src/services/browserMediaService.ts` (`openDb`/`tx` helpers, `put/get/delete` over `Uint8Array`). New DB `leclap-projects`, store `blobs`. Holds each clip's bytes and the completed output's bytes, addressed by key. Kept separate from `leclap-media` so deletion/lifecycle is independent.

Clips are `File` objects (not JSON-serializable) — metadata (`name`, `type`, `size`, `blobKey`) lives in the project record; bytes live in IndexedDB; on resume a `File` is reconstructed via `new File([bytes], name, { type })` so compile + previews work unchanged.

### Data model (`StoredProject`)

```ts
export type ProjectStatus = 'draft' | 'completed';

export interface StoredClip {
  blobKey: string;
  name: string;
  type: string;
  size: number;
}
export interface StoredOutput {
  blobKey: string;
  size: number;
  duration?: number;
}

export interface StoredProject {
  id: string;
  name: string; // default `${templateName}` + short date; rename optional (v1: derived)
  templateId: string;
  templateName: string;
  orientation: 'landscape' | 'portrait';
  status: ProjectStatus;
  stepIndex: number;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null; // from admin/templateEditorModel
  backgroundChoice: MediaChoice | null;
  clips: Record<string, StoredClip>; // sectionName → clip metadata
  edits: Record<string, VideoEdit | undefined>; // from domain/valueObjects/videoEdits
  output?: StoredOutput; // present once status === 'completed'
  createdAt: number;
  updatedAt: number;
}
```

`MediaChoice` and `VideoEdit` are already JSON-safe (no blobs) — `MediaChoice` references uploaded media by `media://<key>` in the existing `browserMediaService`, so it persists as-is.

---

## File map

- **Create** `src/stores/projectStore.ts` — `UserProjectService` (localStorage CRUD). _TDD._
- **Create** `src/services/projectBlobStore.ts` — `ProjectBlobStore` class (injectable backend; `put/get/delete/has`). _TDD._
- **Create** `src/services/projectBlobBackend.ts` — IndexedDB backend (mirror `browserMediaService.ts`) + exported `projectBlobStore` singleton. _thin, untested like its sibling._
- **Create** `src/services/projectService.ts` — orchestration: `saveDraft`, `loadProject`, `deleteProject`, `saveCompleted`, `listProjects`. Bridges the two stores + reconstructs `File`s. _pure helpers TDD; IO integration light._
- **Create** `src/hooks/useProjects.ts` — list + refresh + delete for the page (thin).
- **Create** `src/presentation/pages/ProjectsPage.tsx` — the manager screen. _UI skills._
- **Create** `src/presentation/components/projects/ProjectCard.tsx` — one project card. _UI skills._
- **Create** `src/lib/projectModel.ts` — pure mappers `modelToProject(...)` / `projectToModel(...)` between `WizardModel`+template and `StoredProject` (no IO). _TDD._
- **Create** `src/i18n/locales/en/projects.json` — namespace.
- **Modify** `src/presentation/pages/Builder.tsx` — `useBuilderController`: read `?projectId`, hydrate, auto-save, persist completed, reset clears current project.
- **Modify** `src/App.tsx` — add `<Route path="/projects" element={<ProjectsPage />} />`.
- **Modify** `src/presentation/components/Header.tsx` — add `{ labelKey: 'nav.projects', href: '/projects' }` to `navigationItems`.
- **Modify** `src/i18n/locales/en/common.json` — add `nav.projects`.

---

## AREA 1 — Persistence core (TDD, no UI)

### Task 1: `projectModel.ts` — pure model ⇄ project mappers

- **Files:** create `src/lib/projectModel.ts` + `src/lib/projectModel.test.ts`.
- [ ] Write failing tests: `modelToProject(model, template, prev?)` produces a `StoredProject` carrying `templateId/templateName/orientation/status/stepIndex/formData/choices/edits` and clip **metadata** (given a `clips` meta map); preserves `createdAt` from `prev`, bumps `updatedAt`. `projectToModel(project, clipFiles)` rebuilds a `WizardModel` (clips from the supplied `File` map, edits, choices, stepIndex). Round-trip is stable. Status defaults to `draft`.
- [ ] Implement pure functions (no IO, no blob handling — caller supplies clip `File`s / metadata). Guard clauses, no `else`.
- [ ] Verify pass. Commit (ask first): `feat(web): project ⇄ wizard-model mappers`.

### Task 2: `projectStore.ts` — localStorage CRUD (mirror UserTemplateService)

- **Files:** create `src/stores/projectStore.ts` + `.test.ts`.
- [ ] Failing tests with a fake `Storage`: `list/get/save(upsert by id)/remove/rename`; `save` sets `createdAt` once and bumps `updatedAt`; corrupt/empty storage → `[]`; quota throw is swallowed (best-effort).
- [ ] Implement `UserProjectService` copying `UserTemplateService`'s shape (injectable `Storage`, `now`, `makeId`; key `leclap.projects`). Export an app singleton bound to `localStorage`.
- [ ] Verify pass. Commit (ask first): `feat(web): localStorage project store`.

### Task 3: `projectBlobStore.ts` + IndexedDB backend (mirror browserMediaService)

- **Files:** create `src/services/projectBlobStore.ts` + `.test.ts`, and `src/services/projectBlobBackend.ts`.
- [ ] Failing tests for `ProjectBlobStore` with a fake backend: `put(key, bytes)`, `get → bytes | null`, `delete`, `has`. Key generator deterministic in tests.
- [ ] Implement `ProjectBlobStore` (injectable `BlobBackend { put/get/delete }`). Implement `projectBlobBackend.ts` as the IndexedDB backend (copy `openDb`/`tx` from `browserMediaService.ts`, DB `leclap-projects`, store `blobs`, keyPath `key`) and export `projectBlobStore` singleton.
- [ ] Verify pass. Commit (ask first): `feat(web): IndexedDB blob store for project media`.

### Task 4: `projectService.ts` — orchestration

- **Files:** create `src/services/projectService.ts` (+ `.test.ts` for the pure diffing helper).
- [ ] `saveDraft(model, template, current?)`: write any **new** clip `File`s to the blob store (key per section; only write when the section's `File` identity differs from `current.clips[section]` — a small pure `diffClips(prev, model)` helper, **TDD**), prune blobs for removed sections, then `modelToProject` + `projectStore.save`. Returns the saved `StoredProject`.
- [ ] `loadProject(id)`: read `StoredProject`, fetch each clip's bytes → `new File([bytes], meta.name, { type: meta.type })`, then `projectToModel`. Resolve the `Template` via `templateService.getAllTemplates()` (by `templateId`); if the template is gone, surface a typed "template removed" result.
- [ ] `saveCompleted(projectId, processed)`: write `processed.blob` bytes to blob store, set `status:'completed'` + `output`, save.
- [ ] `deleteProject(id)`: delete all clip blobs + output blob, then remove the record (no orphans).
- [ ] Verify the `diffClips` test passes; smoke the IO paths in the manual step. Commit (ask first): `feat(web): project persistence orchestration`.

---

## AREA 2 — Builder integration

### Task 5: hydrate Builder from `?projectId`

- **Files:** modify `Builder.tsx` (`useBuilderController` ~L543; uses `useSearchParams` from react-router).
- [ ] On mount, if `?projectId` present: set a `hydrating` flag, `await projectService.loadProject(id)`, then `setSelectedTemplate` + `setModel`, and remember `currentProjectId`. If `status:'completed'` and `output` exists, hydrate the result (see Task 7). Show a lightweight loading state while blobs read (reuse the existing engine-loading affordance / a `Reveal` skeleton).
- [ ] Template-removed result → toast/inline notice + fall back to the template picker.
- [ ] Verify (after Task 8 UI): resume restores formData + clips + step. Commit (ask first): `feat(web): resume a project into the builder`.

### Task 6: auto-save drafts

- **Files:** modify `Builder.tsx`.
- [ ] Track `currentProjectId` (ref/state). A **debounced** effect (~600ms) watches `selectedTemplate` + `model`: once a template is selected, call `projectService.saveDraft(model, selectedTemplate, current)`; first save assigns `currentProjectId`. Skip while `isProcessing`. Never persist an empty (no-template) project.
- [ ] `onReset` clears `currentProjectId` so "start over" begins a fresh project; `onTemplateSelected` keeps the current project (template swap updates it).
- [ ] Avoid redundant blob writes via `diffClips` (Task 4).
- [ ] Verify: edits appear in `/projects` within ~1s; refresh keeps them. Commit (ask first): `feat(web): auto-save builder drafts`.

### Task 7: persist + re-open completed result

- **Files:** modify `Builder.tsx` (`startProcessing` success ~L493; `useVideoProcessing` result path).
- [ ] On successful compile, call `projectService.saveCompleted(currentProjectId, processedVideo)` (status → `completed`).
- [ ] Re-open path: when hydrating a completed project, load `output` bytes → build a `ProcessedVideo` (`blob`, `url = createObjectURL`, `size`, `duration`) and feed the **result step** (`ExportPanel`) without recompiling. Plumb an optional `hydratedResult` into `useBuilderController` / the result render; **revoke** the object URL on unmount/replace.
- [ ] Verify: finish a render → project flips to `completed`; "View" re-opens the result. Commit (ask first): `feat(web): persist and re-open finished videos`.

---

## AREA 3 — Projects page & nav (UI skills)

### Task 8: `ProjectsPage` + `ProjectCard` + empty state

- **Files:** create `ProjectsPage.tsx`, `components/projects/ProjectCard.tsx`; create `i18n/locales/en/projects.json`.
- [ ] **ProjectCard** (apply `impeccable`/`ui-ux-pro-max`): reuse the **poster** treatment from the template cards — seeded gradient band via `coverGradient(project.id)` (from `src/lib/poster.ts`), a status `Badge` (`draft`/`completed`), template name, relative `updatedAt` ("2h ago"), and a clip-progress meta (`{filled}/{total}` clips). Actions: **Resume** (draft) / **View** (completed) → `/builder?projectId=<id>`; **Delete** via the existing `Dialog` confirm. Reuse `Card`, `Badge`, `Button`, `lift`/`tap`. Light + dark, reduced-motion.
- [ ] **ProjectsPage**: header band with title + "New project" CTA (→ `/builder`); optional All/Drafts/Completed filter reusing the magnetic `Segmented` from `TemplateSearchBar`; responsive grid of `ProjectCard` wrapped in `Reveal` (staggered); `<EmptyState icon={FolderOpen} …>` (reuse `src/presentation/components/EmptyState.tsx`) guiding the user to start a build when none exist. All copy via `t()` from `projects.json`.
- [ ] `useProjects()` hook: `listProjects()` sorted by `updatedAt` desc, `refresh`, `remove(id)`.
- [ ] Verify in `pnpm playground:web`. Commit (ask first): `feat(web): projects manager page`.

### Task 9: route + header nav + i18n

- **Files:** modify `App.tsx`, `Header.tsx`, `common.json`.
- [ ] Add the `/projects` route; add `{ labelKey: 'nav.projects', href: '/projects' }` to `navigationItems`; add `nav.projects` to `common.json`.
- [ ] Verify nav highlights on `/projects`, mobile menu includes it. Commit (ask first): `feat(web): projects nav entry + route`.

---

## Verification (end-to-end)

1. **Unit:** `pnpm --filter @leclap/web exec vitest run src/lib/projectModel.test.ts src/stores/projectStore.test.ts src/services/projectBlobStore.test.ts src/services/projectService.test.ts` → green.
2. **Types/lint:** `pnpm --filter @leclap/web exec tsc --noEmit` and `pnpm lint` clean (no `eslint-disable`, no `else`, no hardcoded UI strings).
3. **Manual (`pnpm playground:web`), light + dark, reduced-motion:**
   - Start a build, fill a form field + add one clip, **navigate away**, open **/projects** → the draft is listed; **Resume** restores the template, form value, clip (preview works), and step.
   - **Refresh** the page mid-build → draft persists (check DevTools → Application → IndexedDB `leclap-projects` has blobs, localStorage `leclap.projects` has metadata).
   - Finish a render → project flips to **completed**; **View** re-opens the finished video in the result screen without recompiling; Download still works.
   - **Delete** a project → it disappears and its IndexedDB blobs + localStorage entry are gone (no orphans).
   - Empty state shows when no projects; "New project" routes to the builder.
4. Keyboard: cards are focusable, Delete confirm is reachable; focus rings present.

## Notes

- **Reuses:** `UserTemplateService` shape (`projectStore`), `browserMediaService` IndexedDB shape (`projectBlobBackend`), `coverGradient`/poster cards, `EmptyState`, magnetic `Segmented`, `Dialog`, `templateService.getAllTemplates`, `useVideoProcessing`'s `ProcessedVideo`.
- **Blob hygiene:** reconstruct `File` with stored `name`/`type`; `URL.revokeObjectURL` every preview/result URL on unmount/replace; deleting a project purges its blobs.
- **Out of scope (v1):** background compile queue, project rename UI, thumbnails, cross-device sync. Status set is `draft | completed` (a failed compile stays a resumable draft).
- **No commit without consent:** every commit step = ask, then commit. Conventional, lowercase, short subject, no body, no trailer.
