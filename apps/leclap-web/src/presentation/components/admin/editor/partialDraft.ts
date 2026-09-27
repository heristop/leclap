import type { TemplatePartial } from '@leclap/creative-kit/partials';
import {
  buildDescriptor,
  toEditorState,
  type EditableTemplate,
  type EditorState,
  type TemplateDescriptor,
} from '../templateEditorModel';

// A partial's placeholder defaults ride in the draft as its global variables, so colour fields resolve
// them while editing and a save writes them back instead of dropping them.
export function draftStateFromPartial(partial: TemplatePartial): EditorState {
  const template: EditableTemplate = {
    id: partial.id,
    name: partial.id,
    description: partial.description,
    orientation: 'landscape',
    descriptor: {
      global: { orientation: 'landscape', ...(partial.variables ? { variables: partial.variables } : {}) },
      sections: partial.sections as unknown as TemplateDescriptor['sections'],
    },
  };

  return toEditorState(template);
}

const partialVariables = (state: EditorState): Record<string, string> | undefined => {
  const entries = state.globalVariables.filter((v) => v.name.trim() !== '').map((v) => [v.name, v.value] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export function partialFromDraftState(state: EditorState): TemplatePartial {
  const variables = partialVariables(state);

  return {
    id: state.id,
    description: state.description,
    ...(variables ? { variables } : {}),
    sections: (buildDescriptor(state).sections ?? []) as unknown as TemplatePartial['sections'],
  };
}
