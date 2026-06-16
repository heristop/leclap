import { describe, expect, it } from 'vitest';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { newSection } from '../templateEditorModel';
import { draftStateFromPartial, partialFromDraftState } from './partialDraft';

const partial: TemplatePartial = {
  id: 'local:intro',
  description: 'Intro fragment',
  sections: [
    { name: 'intro', type: 'color_background', options: { duration: 2, backgroundColor: '#111111' } },
    {
      name: 'name',
      type: 'form',
      options: { fields: [{ name: 'first_name', label: { en: 'First name' }, maxLength: 32 }] },
    },
  ],
};

describe('partialDraft', () => {
  it('hydrates a partial into an editor draft state', () => {
    const state = draftStateFromPartial(partial);

    expect(state.id).toBe('local:intro');
    expect(state.name).toBe('local:intro');
    expect(state.description).toBe('Intro fragment');
    expect(state.sections.map((section) => section.kind)).toEqual(['color', 'form']);
  });

  it('serializes an editor draft back to a partial descriptor fragment', () => {
    const state = draftStateFromPartial(partial);
    const saved = partialFromDraftState({ ...state, sections: [newSection('color')] });

    expect(saved).toEqual({
      id: 'local:intro',
      description: 'Intro fragment',
      sections: [{ name: 'color_1', type: 'color_background', options: { duration: 3, backgroundColor: '#7C83FD' } }],
    });
  });
});
