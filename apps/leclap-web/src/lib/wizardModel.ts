import type { MediaChoice } from '@leclap/creative-kit/editor';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';

// All builder inputs in one state object so the Builder component stays small. `selectedTemplate` is
// tracked separately — picking one resets the model. Shared here (not on the page) so the project
// persistence layer can map to/from it without depending on the page module.
export interface WizardModel {
  clipsBySection: Record<string, File>;
  // Candidate takes per section; the SELECTED take lives in `clipsBySection`. Not persisted.
  rushesBySection: Record<string, File[]>;
  editsBySection: Record<string, VideoEdit | undefined>;
  formData: Record<string, string>;
  musicChoice: MediaChoice | null;
  backgroundChoice: MediaChoice | null;
  stepIndex: number;
}

export const EMPTY_MODEL: WizardModel = {
  clipsBySection: {},
  rushesBySection: {},
  editsBySection: {},
  formData: {},
  musicChoice: null,
  backgroundChoice: null,
  stepIndex: 0,
};
