import type { VideoEdit } from '@/domain/valueObjects/videoEdits';

// The minimal model slice the rush actions operate on. A section keeps several candidate takes
// ("rushes") in `rushesBySection`, while `clipsBySection` holds the single SELECTED take that the
// render path and completion checks read. Edits follow the selection (not remembered per rush).
export interface RushModel {
  clipsBySection: Record<string, File>;
  rushesBySection: Record<string, File[]>;
  editsBySection: Record<string, VideoEdit | undefined>;
}

// Append a take to a section. The first take becomes the selection automatically; later takes leave
// the current selection untouched.
export const addRush = (model: RushModel, sectionName: string, file: File): RushModel => {
  const existing = model.rushesBySection[sectionName] ?? [];
  const rushesBySection = { ...model.rushesBySection, [sectionName]: [...existing, file] };

  if (Object.hasOwn(model.clipsBySection, sectionName)) {
    return { ...model, rushesBySection };
  }

  return { ...model, rushesBySection, clipsBySection: { ...model.clipsBySection, [sectionName]: file } };
};

// Make `file` the selected take for a section and reset that section's edit (the edit belonged to the
// previously-selected clip). Lenient: selects even a file that isn't in the section's rush list.
export const selectRush = (model: RushModel, sectionName: string, file: File): RushModel => ({
  ...model,
  clipsBySection: { ...model.clipsBySection, [sectionName]: file },
  editsBySection: { ...model.editsBySection, [sectionName]: undefined },
});

// Drop a take from a section. If the removed take was selected, fall back to the first remaining take
// (resetting the edit); if none remain, clear the selection and the edit for that section.
export const removeRush = (model: RushModel, sectionName: string, file: File): RushModel => {
  const remaining = (model.rushesBySection[sectionName] ?? []).filter((f) => f !== file);
  const rushesBySection = { ...model.rushesBySection, [sectionName]: remaining };
  const wasSelected = model.clipsBySection[sectionName] === file;

  if (!wasSelected) {
    return { ...model, rushesBySection };
  }

  const clipsBySection = { ...model.clipsBySection };
  const editsBySection = { ...model.editsBySection, [sectionName]: undefined };

  if (remaining.length === 0) {
    delete clipsBySection[sectionName];

    return { ...model, rushesBySection, clipsBySection, editsBySection };
  }

  return {
    ...model,
    rushesBySection,
    clipsBySection: { ...clipsBySection, [sectionName]: remaining[0] },
    editsBySection,
  };
};
