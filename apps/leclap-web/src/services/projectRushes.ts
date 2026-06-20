import { projectBlobStore } from '@/services/projectBlobBackend';
import type { StoredClip } from '@/lib/projectModel';
import type { WizardModel } from '@/lib/wizardModel';

// Index access that is honest about absence (the tsconfig doesn't enable noUncheckedIndexedAccess).
const pick = <T>(record: Record<string, T>, key: string): T | undefined => record[key];

// A take to (re)write, located by its section + position in that section's take list.
export interface RushWriteTarget {
  section: string;
  index: number;
}

export interface RushDiff {
  // Takes whose bytes need a fresh blob written (new or replaced).
  write: RushWriteTarget[];
  // Blob keys to delete (takes that were removed or replaced).
  prune: string[];
}

// Find a previously stored take with the same name + size — its bytes are identical, so reuse its key.
function matchPrev(prev: StoredClip[], file: File): StoredClip | undefined {
  return prev.find((clip) => clip.name === file.name && clip.size === file.size);
}

// Pure: compare the previously stored takes against the current model, per section. A take is
// "unchanged" when some prev take shares its name + size; new/changed takes go in `write`, and prev
// takes whose name + size no longer appears go in `prune`. Matching by name + size (not strict index)
// is robust to reordering and mirrors diffClips.
export function diffRushes(
  prevRushes: Record<string, StoredClip[]>,
  rushesBySection: Record<string, File[]>
): RushDiff {
  const write: RushWriteTarget[] = [];
  const prune: string[] = [];
  const sections = new Set([...Object.keys(prevRushes), ...Object.keys(rushesBySection)]);

  for (const section of sections) {
    const prev = pick(prevRushes, section) ?? [];
    const files = pick(rushesBySection, section) ?? [];

    for (const [index, file] of files.entries()) {
      if (!matchPrev(prev, file)) write.push({ section, index });
    }

    for (const clip of prev) {
      const stillPresent = files.some((file) => file.name === clip.name && file.size === clip.size);

      if (!stillPresent) prune.push(clip.blobKey);
    }
  }

  return { write, prune };
}

// Reuse the prev take metadata when name + size match; otherwise read the bytes and mint a fresh blob.
async function materializeTake(prev: StoredClip[], file: File): Promise<StoredClip> {
  const reused = matchPrev(prev, file);

  if (reused) return reused;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const blobKey = await projectBlobStore.put(bytes);

  return { blobKey, name: file.name, type: file.type, size: file.size };
}

// Build the next section → takes map, writing only the bytes the diff marked (one blob per new take).
export async function materializeRushes(
  prevRushes: Record<string, StoredClip[]>,
  model: WizardModel,
  _diff: RushDiff
): Promise<Record<string, StoredClip[]>> {
  const entries = await Promise.all(
    Object.entries(model.rushesBySection).map(async ([section, files]) => {
      const prev = pick(prevRushes, section) ?? [];
      const takes = await Promise.all(files.map((file) => materializeTake(prev, file)));

      return [section, takes] as const;
    })
  );

  return Object.fromEntries(entries);
}

// Pick, per section, the stored take that matches the selected File by name + size. The selected clip
// shares the matching take's blobKey (no double-write); given the union invariant, a match always exists.
export function deriveSelectedClips(
  rushes: Record<string, StoredClip[]>,
  model: WizardModel
): Record<string, StoredClip> {
  const clips: Record<string, StoredClip> = {};

  for (const [section, file] of Object.entries(model.clipsBySection)) {
    const takes = pick(rushes, section) ?? [];
    const match = takes.find((clip) => clip.name === file.name && clip.size === file.size) ?? takes.at(0);

    if (match) clips[section] = match;
  }

  return clips;
}

// Union the selected File into its section's take list (the invariant) so the selected clip always
// matches a stored take and never needs its own blob.
export function withSelectedRushes(model: WizardModel): Record<string, File[]> {
  const effective: Record<string, File[]> = { ...model.rushesBySection };

  for (const [section, file] of Object.entries(model.clipsBySection)) {
    const takes = pick(effective, section) ?? [];
    const present = takes.some((take) => take.name === file.name && take.size === file.size);
    effective[section] = present ? takes : [...takes, file];
  }

  return effective;
}
