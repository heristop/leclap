import type { TemplatePartial } from '@leclap/creative-kit/partials';
import {
  buildDescriptor,
  toEditorState,
  type EditableTemplate,
  type EditorState,
  type TemplateDescriptor,
} from '../templateEditorModel';

export function draftStateFromPartial(partial: TemplatePartial): EditorState {
  const template: EditableTemplate = {
    id: partial.id,
    name: partial.id,
    description: partial.description,
    orientation: 'landscape',
    descriptor: {
      global: { orientation: 'landscape' },
      sections: partial.sections as unknown as TemplateDescriptor['sections'],
    },
  };

  return toEditorState(template);
}

export function partialFromDraftState(state: EditorState): TemplatePartial {
  return {
    id: state.id,
    description: state.description,
    sections: (buildDescriptor(state).sections ?? []) as unknown as TemplatePartial['sections'],
  };
}
