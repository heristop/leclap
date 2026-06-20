import { describe, it, expect } from 'vitest';
import { initialSectionSelection, sectionSelectionReducer, type SectionSelectionState } from './useSectionSelection';

describe('sectionSelectionReducer', () => {
  it('selectText sets the element and clears editing', () => {
    const next = sectionSelectionReducer({ element: null, editing: true }, { type: 'selectText', index: 2 });

    expect(next).toEqual({ element: { kind: 'text', index: 2 }, editing: false });
  });

  it('selectText replaces a prior selection and drops its edit', () => {
    const prior: SectionSelectionState = { element: { kind: 'text', index: 0 }, editing: true };

    expect(sectionSelectionReducer(prior, { type: 'selectText', index: 3 })).toEqual({
      element: { kind: 'text', index: 3 },
      editing: false,
    });
  });

  it('beginEdit only arms editing when an element is selected', () => {
    expect(sectionSelectionReducer(initialSectionSelection, { type: 'beginEdit' })).toBe(initialSectionSelection);

    const selected: SectionSelectionState = { element: { kind: 'text', index: 1 }, editing: false };

    expect(sectionSelectionReducer(selected, { type: 'beginEdit' })).toEqual({
      element: { kind: 'text', index: 1 },
      editing: true,
    });
  });

  it('endEdit clears editing but keeps the selection', () => {
    const editing: SectionSelectionState = { element: { kind: 'text', index: 1 }, editing: true };

    expect(sectionSelectionReducer(editing, { type: 'endEdit' })).toEqual({
      element: { kind: 'text', index: 1 },
      editing: false,
    });
  });

  it('clear resets to the initial selection', () => {
    const editing: SectionSelectionState = { element: { kind: 'text', index: 4 }, editing: true };

    expect(sectionSelectionReducer(editing, { type: 'clear' })).toEqual(initialSectionSelection);
  });
});
