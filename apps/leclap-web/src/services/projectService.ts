import { templateService, type Template } from '@/services/templateService';
import { projectStore } from '@/stores/projectStore';
import { projectBlobStore } from '@/services/projectBlobBackend';
import { modelToProject, projectToModel, type StoredClip, type StoredProject } from '@/lib/projectModel';
import type { WizardModel } from '@/lib/wizardModel';

export interface ClipDiff {
  // Section names whose clip needs a fresh blob written (new or replaced).
  write: string[];
  // Blob keys to delete (clips that were removed or replaced).
  prune: string[];
}

// Index access that is honest about absence (the tsconfig doesn't enable noUncheckedIndexedAccess).
const pick = <T>(record: Record<string, T>, key: string): T | undefined => record[key];

// Pure: compare the previously stored clip metadata against the current model. A clip is "unchanged"
// when its file name + size match — enough to skip re-writing the same bytes between auto-saves.
export function diffClips(prevClips: Record<string, StoredClip>, clipsBySection: Record<string, File>): ClipDiff {
  const write: string[] = [];
  const prune: string[] = [];
  const sections = new Set([...Object.keys(prevClips), ...Object.keys(clipsBySection)]);

  for (const section of sections) {
    const prev = pick(prevClips, section);
    const file = pick(clipsBySection, section);

    if (!file) {
      if (prev) prune.push(prev.blobKey);

      continue;
    }

    if (prev && prev.name === file.name && prev.size === file.size) continue;

    write.push(section);

    if (prev) prune.push(prev.blobKey);
  }

  return { write, prune };
}

function makeId(): string {
  try {
    return `project-${globalThis.crypto.randomUUID()}`;
  } catch {
    return `project-${Date.now()}`;
  }
}

// Keep unchanged clip metadata, write the bytes for new/replaced clips, and assemble the next
// section → clip map. Split out of saveDraft to keep its branch count down.
async function materializeClips(
  prevClips: Record<string, StoredClip>,
  model: WizardModel,
  diff: ClipDiff
): Promise<Record<string, StoredClip>> {
  const clips: Record<string, StoredClip> = {};

  for (const [section, meta] of Object.entries(prevClips)) {
    if (pick(model.clipsBySection, section)) clips[section] = meta;
  }

  const written = await Promise.all(
    diff.write.map(async (section) => {
      const file = model.clipsBySection[section];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blobKey = await projectBlobStore.put(bytes);

      return [section, { blobKey, name: file.name, type: file.type, size: file.size }] as const;
    })
  );

  for (const [section, meta] of written) clips[section] = meta;

  return clips;
}

// Persist (or update) a draft: write any new clip bytes, prune replaced/removed ones, then save the
// metadata record. Editing always lands as a `draft` — a prior compiled output is invalidated.
export async function saveDraft(model: WizardModel, template: Template, currentId?: string): Promise<StoredProject> {
  const current = currentId ? (projectStore.get(currentId) ?? undefined) : undefined;
  const prevClips = current?.clips ?? {};
  const diff = diffClips(prevClips, model.clipsBySection);
  const clips = await materializeClips(prevClips, model, diff);

  const stalePrune = current?.output ? [...diff.prune, current.output.blobKey] : diff.prune;
  await Promise.all(stalePrune.map((key) => projectBlobStore.delete(key)));

  return projectStore.save(
    modelToProject({
      id: current?.id ?? makeId(),
      model,
      template,
      clips,
      now: Date.now(),
      createdAt: current?.createdAt,
      name: current?.name,
      status: 'draft',
    })
  );
}

// Give a project a custom title (falls back to the existing name when blank).
export function renameProject(id: string, name: string): StoredProject | null {
  const current = projectStore.get(id);

  if (!current) return null;

  return projectStore.save({ ...current, name: name.trim() || current.name, updatedAt: Date.now() });
}

// Clone a project's clips + answers into a fresh draft (its own blob copies, no carried-over output).
export async function duplicateProject(id: string): Promise<StoredProject | null> {
  const source = projectStore.get(id);

  if (!source) return null;

  const clipEntries = await Promise.all(
    Object.entries(source.clips).map(async ([section, clip]) => {
      const bytes = await projectBlobStore.get(clip.blobKey);

      if (!bytes) return null;

      const blobKey = await projectBlobStore.put(bytes);

      return [section, { ...clip, blobKey }] as const;
    })
  );

  const clips = Object.fromEntries(
    clipEntries.filter((entry): entry is readonly [string, StoredClip] => entry !== null)
  );
  const now = Date.now();

  return projectStore.save({
    ...source,
    id: makeId(),
    name: `${source.name} (copy)`,
    status: 'draft',
    output: undefined,
    clips,
    createdAt: now,
    updatedAt: now,
  });
}

export type LoadResult =
  | { ok: true; project: StoredProject; template: Template; model: WizardModel }
  | { ok: false; reason: 'not-found' | 'template-removed' };

// Read a project back into a builder-ready (template, model) pair, materializing clip Files from the
// blob store. Returns a typed failure when the project or its template no longer exists.
export async function loadProject(id: string): Promise<LoadResult> {
  const project = projectStore.get(id);

  if (!project) return { ok: false, reason: 'not-found' };

  const templates = await templateService.getAllTemplates();
  const template = templates.find((candidate) => candidate.id === project.templateId);

  if (!template) return { ok: false, reason: 'template-removed' };

  const entries = await Promise.all(
    Object.entries(project.clips).map(async ([section, meta]) => {
      const bytes = await projectBlobStore.get(meta.blobKey);

      return bytes ? ([section, new File([new Uint8Array(bytes)], meta.name, { type: meta.type })] as const) : null;
    })
  );

  const clipFiles = Object.fromEntries(entries.filter((entry): entry is readonly [string, File] => entry !== null));

  return { ok: true, project, template, model: projectToModel(project, clipFiles) };
}

export interface CompiledOutput {
  blob: Blob;
  size: number;
  duration?: number;
}

// Persist a finished render against its project and flip it to `completed`.
export async function saveCompleted(projectId: string, output: CompiledOutput): Promise<StoredProject | null> {
  const current = projectStore.get(projectId);

  if (!current) return null;

  if (current.output) await projectBlobStore.delete(current.output.blobKey);

  const bytes = new Uint8Array(await output.blob.arrayBuffer());
  const blobKey = await projectBlobStore.put(bytes);

  return projectStore.save({
    ...current,
    status: 'completed',
    output: { blobKey, size: output.size, duration: output.duration },
    updatedAt: Date.now(),
  });
}

// Materialize a completed project's output blob so the result screen can re-open it without a recompile.
export async function loadOutput(project: StoredProject): Promise<CompiledOutput | null> {
  if (!project.output) return null;

  const bytes = await projectBlobStore.get(project.output.blobKey);

  if (!bytes) return null;

  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'video/mp4' }),
    size: project.output.size,
    duration: project.output.duration,
  };
}

// Remove a project and every blob it owns (no orphans left in IndexedDB).
export async function deleteProject(id: string): Promise<void> {
  const project = projectStore.get(id);

  if (project) {
    const keys = Object.values(project.clips).map((clip) => clip.blobKey);

    if (project.output) keys.push(project.output.blobKey);

    await Promise.all(keys.map((key) => projectBlobStore.delete(key)));
  }

  projectStore.remove(id);
}

export function listProjects(): StoredProject[] {
  return [...projectStore.list()].sort((a, b) => b.updatedAt - a.updatedAt);
}
