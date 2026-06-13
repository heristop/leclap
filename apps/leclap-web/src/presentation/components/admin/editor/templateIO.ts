// Pure JSON import/export for the builder. Export serialises the built descriptor; import parses
// arbitrary JSON, validates it against the core schema, and (on success) re-hydrates an EditorState
// — round-tripping cleanly because buildDescriptor / toEditorState are inverse. No DOM dependency
// (the actual file download/upload wiring lives in the component); unit-testable in node.
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { buildDescriptor, toEditorState, type EditorState, type TemplateDescriptor } from '../templateEditorModel';

export interface ImportSuccess {
  ok: true;
  state: EditorState;
}

export interface ImportFailure {
  ok: false;
  // Human-readable lines like "sections.0.type: Invalid enum value" for the error dialog.
  errors: string[];
}

export type ImportResult = ImportSuccess | ImportFailure;

// Pretty-printed descriptor JSON for download.
export function exportDescriptorJson(state: EditorState): string {
  return JSON.stringify(buildDescriptor(state), null, 2);
}

// A filesystem-safe filename derived from the template name (falls back to "template").
export function exportFilename(state: EditorState): string {
  const base = state.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base === '' ? 'template' : base}.json`;
}

// Flatten a zod error into readable "path: message" lines for the import-failure dialog.
function readableZodErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';

    return `${path}: ${issue.message}`;
  });
}

// Parse + validate raw JSON text into an EditorState, carrying over the current id/name/meta so the
// import lands as an undoable edit of the same template (not a brand-new one). On any failure the
// zod issues are surfaced verbatim.
export function importDescriptorJson(text: string, current: EditorState): ImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`] };
  }

  const result = TemplateDescriptorSchema.safeParse(parsed);

  if (!result.success) {
    return { ok: false, errors: readableZodErrors(result.error) };
  }

  const descriptor = result.data as TemplateDescriptor;
  const state = toEditorState({
    id: current.id,
    name: current.name,
    description: current.description,
    orientation: descriptor.global?.orientation === 'portrait' ? 'portrait' : current.orientation,
    descriptor,
  });

  return { ok: true, state };
}
