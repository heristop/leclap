import type { MediaChoice } from '@leclap/creative-kit/editor';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { Template } from '@/services/templateService';
import type { WizardModel } from './wizardModel';

export type ProjectStatus = 'draft' | 'completed';

// A clip's bytes live in IndexedDB under `blobKey`; this is the metadata kept in the project record
// so a `File` can be reconstructed (name + type) on resume.
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

// A saved build session. Serializable: clip/output bytes are referenced by IndexedDB key, and both
// MediaChoice and VideoEdit are plain JSON (uploads reference media by key, not blobs).
export interface StoredProject {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  orientation: Template['orientation'];
  status: ProjectStatus;
  stepIndex: number;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  clips: Record<string, StoredClip>;
  edits: Record<string, VideoEdit | undefined>;
  output?: StoredOutput;
  createdAt: number;
  updatedAt: number;
}

export interface ModelToProjectInput {
  id: string;
  model: WizardModel;
  template: Template;
  // Section → clip metadata, computed by the caller after writing bytes to the blob store.
  clips: Record<string, StoredClip>;
  now: number;
  // Carried over from the existing record so the creation time is stable across saves.
  createdAt?: number;
  // A user-set title; falls back to the template name when the project hasn't been renamed.
  name?: string;
  status?: ProjectStatus;
  output?: StoredOutput;
}

// Pure: fold the in-memory wizard model + its template into a serializable project record.
export function modelToProject(input: ModelToProjectInput): StoredProject {
  const { id, model, template, clips, now, createdAt, name, status = 'draft', output } = input;

  return {
    id,
    name: name ?? template.name,
    templateId: template.id,
    templateName: template.name,
    orientation: template.orientation,
    status,
    stepIndex: model.stepIndex,
    formData: model.formData,
    musicChoice: model.musicChoice,
    backgroundChoice: model.backgroundChoice,
    clips,
    edits: model.editsBySection,
    output,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

// Pure: rebuild the wizard model from a project. The caller supplies clip `File`s (materialized from
// the blob store) since bytes are not part of the record.
export function projectToModel(project: StoredProject, clipFiles: Record<string, File>): WizardModel {
  // Rushes aren't persisted; seed each saved (selected) clip as the single take so the chooser shows it.
  const rushesBySection: Record<string, File[]> = {};

  for (const [name, file] of Object.entries(clipFiles)) {
    rushesBySection[name] = [file];
  }

  return {
    clipsBySection: clipFiles,
    rushesBySection,
    editsBySection: project.edits,
    formData: project.formData,
    musicChoice: project.musicChoice,
    backgroundChoice: project.backgroundChoice,
    stepIndex: project.stepIndex,
  };
}
