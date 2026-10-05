import { describe, expect, it } from 'vitest';
import { newSection, type EditorSection } from '../templateEditorModel';
import { addElement, canAddElement, listSectionElements, removeElement, reorderElement } from './sectionElements';

// A video section carrying one animation and two engine effects (section.graphics).
function withEffects(): EditorSection {
  return {
    ...newSection('video'),
    animations: [{ id: 'a', url: '/assets/animations/confetti.apng' }],
    graphics: [
      { type: 'fx', effect: 'glint', path: 'orbit', at: 0.4 },
      { type: 'flash', at: 1 },
    ],
  } as EditorSection;
}

describe('engine effects as section elements', () => {
  it('lists each graphic after the animations, labelled by its library entry', () => {
    const elements = listSectionElements(withEffects());

    expect(elements.map((element) => element.kind)).toEqual(['animation', 'effect', 'effect']);
    expect(elements[1]).toMatchObject({
      ref: { kind: 'effect', index: 0 },
      labelKey: 'element.effect',
      previewKey: 'animation.library.glint-orbit',
    });
    // A graphic the library does not offer reads as its type.
    expect(elements[2]).toMatchObject({ previewText: 'flash' });
  });

  it('removes and reorders effects, dropping the field when the last one goes', () => {
    const section = withEffects();
    const ref = { kind: 'effect' as const, index: 0 };

    expect(reorderElement(section, ref, 1)).toEqual({
      graphics: [
        { type: 'flash', at: 1 },
        { type: 'fx', effect: 'glint', path: 'orbit', at: 0.4 },
      ],
    });
    expect(removeElement(section, ref)).toEqual({ graphics: [{ type: 'flash', at: 1 }] });
    expect(removeElement({ ...section, graphics: [{ type: 'flash' }] } as EditorSection, ref)).toEqual({
      graphics: undefined,
    });
  });

  it('never adds a blank effect from the add menu (effects start from the animation picker)', () => {
    const section = withEffects();

    expect(canAddElement(section, 'animation')).toBe(true);
    expect(addElement(section, 'animation')?.ref).toEqual({ kind: 'animation', index: 1 });
  });
});
