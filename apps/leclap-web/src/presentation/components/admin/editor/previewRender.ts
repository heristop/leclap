// Pure assembly for the builder's "Preview render": turn the current EditorState into the
// (template, formData, videoConfig) inputs the compile service needs, so an author can see a draft
// of their template without supplying real footage. The placeholder *media* (one clip per
// project_video section) is generated in the browser by placeholderClips.ts — kept separate so this
// module stays DOM-free and unit-testable in node.
import { buildDescriptor, type EditorState, type TemplateDescriptor } from '../templateEditorModel';
import { templateService, type Template } from '@/services/templateService';
import { materializeTemplatePartials } from '@/services/templatePartialService';

// 480p-equivalent, always expressed in landscape (width:height). The engine swaps it to
// 480:854 itself when the descriptor orientation is portrait (see SegmentBuilder), so callers
// pass this single value regardless of orientation.
export const PREVIEW_SCALE = '854:480';

// How many uploaded clips the descriptor consumes — one per project_video section. The preview
// generates exactly this many placeholder clips (keyed video_1…video_N to match the compile
// service's storeUploadedFiles ordering).
export function countProjectVideoSections(descriptor: TemplateDescriptor): number {
  return (descriptor.sections ?? []).filter((s) => s.type === 'project_video').length;
}

// Form fields filled with their own labels, so drawtext overlays that reference {{ field }} render
// something legible in the draft instead of an empty string. Form field names come straight off the
// descriptor's form sections.
export function previewFormData(state: EditorState): Record<string, string> {
  const out: Record<string, string> = {};
  const descriptor = materializeTemplatePartials(buildDescriptor(state));

  for (const field of templateService.extractFormFields(descriptor)) {
    const label = field.label.en?.trim() ?? '';
    out[field.name] = label === '' ? field.name : label;
  }

  // Author global variables also fill in with their own values (buildDescriptor already merges
  // them into global.variables, so nothing to add here) — form fields are the only runtime inputs.
  return out;
}

// A throwaway Template wrapping the freshly-built descriptor, suitable for compileVideo. The id is
// suffixed so it can never collide with or overwrite the saved template.
export function previewTemplate(state: EditorState): Template {
  const descriptor = buildDescriptor(state);

  return {
    id: `${state.id}-preview`,
    name: state.name.trim() === '' ? 'Preview' : state.name.trim(),
    description: state.description.trim(),
    orientation: state.orientation,
    hasForm: templateService.extractFormFields(descriptor).length > 0,
    complexity: templateService.getTemplateComplexity(descriptor),
    source: 'user',
    descriptor,
  };
}

export interface PreviewPlan {
  template: Template;
  formData: Record<string, string>;
  // Number of placeholder clips to generate before compiling.
  clipCount: number;
  // Reduced render scale (landscape form; engine swaps for portrait).
  videoConfig: { scale: string };
}

// Everything the compile call needs except the generated clips (which require the DOM).
export function buildPreviewPlan(state: EditorState): PreviewPlan {
  const template = previewTemplate(state);
  const materialized = materializeTemplatePartials(template.descriptor);

  return {
    template,
    formData: previewFormData(state),
    clipCount: countProjectVideoSections(materialized),
    videoConfig: { scale: PREVIEW_SCALE },
  };
}
