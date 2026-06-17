// Pure assembly for the builder's "Preview render": turn the current EditorState into the
// (template, formData, videoConfig) inputs the compile service needs, so an author can see a draft
// of their template without supplying real footage. The placeholder *media* (one clip per
// project_video section) is loaded in the browser by placeholderClips.ts — kept separate so this
// module stays DOM-free and unit-testable in node.
import { buildDescriptor, type EditorState, type TemplateDescriptor } from '../templateEditorModel';
import { templateService, type Template } from '@/services/templateService';
import { materializeTemplatePartials } from '@/services/templatePartialService';

// A draft only needs to show each scene's look, not its full runtime. Capping every section to a few
// seconds keeps the preview "fast" (its whole point) and — just as important — keeps the multi-segment
// transition assembly light enough for the in-browser WASM encoder, which `Aborted()`s when a long
// template (e.g. 3×20s clips + flash cards + bumper) is re-encoded through a big xfade filtergraph.
export const PREVIEW_MAX_SECTION_SECONDS = 3;

// Clamp `options.duration` on every section so the draft renders short clips. Runs on the built
// descriptor before partials expand; the engine recomputes fades/transition offsets from the clamped
// duration, so a 20s clip's fade-out at st=19.8 becomes st≈2.8 automatically.
function clampPreviewDurations(descriptor: TemplateDescriptor): TemplateDescriptor {
  const sections = (descriptor.sections ?? []).map((section) => {
    const duration = (section as { options?: { duration?: number } }).options?.duration;

    if (typeof duration !== 'number' || duration <= PREVIEW_MAX_SECTION_SECONDS) {
      return section;
    }

    return {
      ...section,
      options: { ...(section as { options?: object }).options, duration: PREVIEW_MAX_SECTION_SECONDS },
    };
  });

  return { ...descriptor, sections } as TemplateDescriptor;
}

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
    const label = field.label.en.trim();
    out[field.name] = label === '' ? field.name : label;
  }

  // Author global variables also fill in with their own values (buildDescriptor already merges
  // them into global.variables, so nothing to add here) — form fields are the only runtime inputs.
  return out;
}

// A throwaway Template wrapping the freshly-built descriptor, suitable for compileVideo. The id is
// suffixed so it can never collide with or overwrite the saved template.
export function previewTemplate(state: EditorState): Template {
  const descriptor = clampPreviewDurations(buildDescriptor(state));

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
  // Optional render-scale override. Left undefined so the draft renders at the template's NATIVE
  // resolution: the partials' drawtext/drawbox use absolute pixel coordinates authored for the native
  // canvas (e.g. x=640, fontsize=150 on 1280x720), so a downscaled preview misplaces and overlaps
  // them. The draft stays fast via the per-section duration cap, not a smaller frame.
  videoConfig?: { scale: string };
}

// Everything the compile call needs except the generated clips (which require the DOM).
export function buildPreviewPlan(state: EditorState): PreviewPlan {
  const template = previewTemplate(state);
  const materialized = materializeTemplatePartials(template.descriptor);

  return {
    template,
    formData: previewFormData(state),
    clipCount: countProjectVideoSections(materialized),
  };
}
