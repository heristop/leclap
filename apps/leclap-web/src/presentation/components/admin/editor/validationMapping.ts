// Pure validation glue for the builder: run the core validator over a built descriptor and
// map each error's descriptor-relative path back to the editor section index it belongs to, so
// the offending section card can surface the message inline (instead of only at save time).
// No React/DOM dependency — unit-testable in node.
import { TemplateValidator, type ValidationError } from 'ffmpeg-video-composer/src/services/TemplateValidator.ts';
import type { EditorState, TemplateDescriptor } from '../templateEditorModel';
import type { StoredPartial } from '@/stores/userPartialStore';
import { materializeTemplatePartials } from '@/services/templatePartialService';

export type { ValidationError };

export interface SectionValidation {
  // Descriptor-section index -> the errors anchored on it. The descriptor index is NOT the editor
  // index (music sections fold into globals); `editorIndexForDescriptor` bridges the two.
  byDescriptorIndex: Map<number, ValidationError[]>;
  // Errors with no resolvable `sections[N]` anchor — surfaced in a top banner.
  global: ValidationError[];
  // True when at least one error exists (hard errors keep Save guarded).
  hasErrors: boolean;
}

const validator = new TemplateValidator();

// Validate a built descriptor, returning the flat error list (empty on success).
export function runValidation(descriptor: TemplateDescriptor, localPartials?: StoredPartial[]): ValidationError[] {
  let materialized: TemplateDescriptor;

  try {
    materialized = materializeTemplatePartials(descriptor, localPartials);
  } catch (error) {
    return [
      {
        path: 'partial',
        message: error instanceof Error ? error.message : 'Could not expand template partials',
        code: 'unknown_partial',
      },
    ];
  }

  const result = validator.validateTemplate(materialized);

  if (result.success) return [];

  return result.errors ?? [];
}

// Pull the leading `sections[N]` index out of a validator path (e.g. "sections[2].transition" -> 2).
// Paths the validator prefixes with "template." (variable refs) are normalised first. Returns null
// when the path carries no section anchor.
export function descriptorIndexFromPath(path: string): number | null {
  const normalised = path.startsWith('template.') ? path.slice('template.'.length) : path;
  const match = /^sections\[(\d+)\]/.exec(normalised);

  if (!match) return null;

  return Number(match[1]);
}

// Group validator errors by their descriptor-section index; anything unanchored becomes global.
export function groupValidationErrors(errors: ValidationError[]): SectionValidation {
  const byDescriptorIndex = new Map<number, ValidationError[]>();
  const global: ValidationError[] = [];

  for (const error of errors) {
    const index = descriptorIndexFromPath(error.path);

    if (index === null) {
      global.push(error);

      continue;
    }

    const bucket = byDescriptorIndex.get(index) ?? [];
    bucket.push(error);
    byDescriptorIndex.set(index, bucket);
  }

  return { byDescriptorIndex, global, hasErrors: errors.length > 0 };
}

// buildDescriptor drops music sections from descriptor.sections, so the descriptor index of a
// rendered section is its editor index minus the count of music sections before it. This produces
// editorIndex -> descriptorIndex (null for music sections, which never appear in descriptor.sections).
export function descriptorIndexForEditor(state: EditorState): Array<number | null> {
  let descriptorIndex = 0;

  return state.sections.map((section) => {
    if (section.kind === 'music') return null;

    return descriptorIndex++;
  });
}

// The inverse lookup the cards need: descriptorIndex -> editorIndex.
export function editorIndexForDescriptor(state: EditorState, descriptorIndex: number): number | null {
  const mapping = descriptorIndexForEditor(state);
  const editorIndex = mapping.findIndex((d) => d === descriptorIndex);

  return editorIndex === -1 ? null : editorIndex;
}

// The errors anchored on a given editor section index, resolved through the descriptor mapping.
export function errorsForEditorSection(
  validation: SectionValidation,
  state: EditorState,
  editorIndex: number
): ValidationError[] {
  const descriptorIndex = descriptorIndexForEditor(state)[editorIndex];

  if (descriptorIndex === null) return [];

  return validation.byDescriptorIndex.get(descriptorIndex) ?? [];
}
