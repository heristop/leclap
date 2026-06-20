import { describe, it, expect } from 'vitest';
import { newSection, newOverlay, type EditorSection } from '../templateEditorModel';
import { newExtraLayer } from '../editor/layerGeometry';
import { listSectionElements, canAddElement, addElement, removeElement, reorderElement } from './sectionElements';

// Read an array field off a Partial<EditorSection> patch. The patch is a discriminated-union
// partial, so field access isn't statically resolvable; the helper narrows for assertions only.
function field<T>(patch: Partial<EditorSection>, name: string): T[] | undefined {
  return (patch as Record<string, unknown>)[name] as T[] | undefined;
}

// A color section carrying a base layer + one extra layer, two text overlays, and one animation —
// the richest cross-kind section, used to exercise the documented flatten order.
function richColorSection(): EditorSection {
  const base = newSection('color');

  if (base.kind !== 'color') throw new Error('expected color section');

  return {
    ...base,
    layers: [newExtraLayer(), newExtraLayer()],
    overlays: [
      { ...newOverlay(), text: 'a' },
      { ...newOverlay(), text: 'b' },
    ],
    animations: [{ id: 'anim-1', url: '/x.apng' }],
  };
}

function videoSection(): EditorSection {
  return newSection('video');
}

describe('listSectionElements', () => {
  it('flattens a color section in layers → text → image → animation order with correct refs', () => {
    const descriptors = listSectionElements(richColorSection());

    expect(descriptors.map((d) => d.kind)).toEqual(['layer', 'layer', 'text', 'text', 'animation']);
    expect(descriptors.map((d) => d.ref)).toEqual([
      { kind: 'layer', index: 0 },
      { kind: 'layer', index: 1 },
      { kind: 'text', index: 0 },
      { kind: 'text', index: 1 },
      { kind: 'animation', index: 0 },
    ]);
    expect(descriptors[0].labelKey).toBe('element.layer');
    expect(descriptors[2].labelParams).toEqual({ n: 1 });
    expect(descriptors[3].labelParams).toEqual({ n: 2 });
  });

  it('contributes nothing for arrays a section does not carry', () => {
    const descriptors = listSectionElements(newSection('form'));

    expect(descriptors).toEqual([]);
  });
});

describe('canAddElement', () => {
  it('matches per-kind array ownership', () => {
    const color = newSection('color');
    const video = newSection('video');
    const image = newSection('image');
    const music = newSection('music');

    expect(canAddElement(color, 'layer')).toBe(true);
    expect(canAddElement(color, 'text')).toBe(true);
    expect(canAddElement(color, 'animation')).toBe(true);
    expect(canAddElement(color, 'image')).toBe(true);

    expect(canAddElement(video, 'layer')).toBe(false);
    expect(canAddElement(video, 'text')).toBe(true);
    expect(canAddElement(video, 'image')).toBe(true);
    expect(canAddElement(video, 'animation')).toBe(true);

    expect(canAddElement(image, 'text')).toBe(true);
    expect(canAddElement(image, 'animation')).toBe(true);
    expect(canAddElement(image, 'image')).toBe(true);
    expect(canAddElement(image, 'layer')).toBe(false);

    expect(canAddElement(music, 'text')).toBe(false);
  });
});

describe('addElement', () => {
  it('appends a layer to a color section and points the ref at the new last index', () => {
    const section = richColorSection();
    const result = addElement(section, 'layer');

    if (!result) throw new Error('expected a patch');

    expect(field(result.patch, 'layers')).toHaveLength(3);
    expect(result.ref).toEqual({ kind: 'layer', index: 2 });
  });

  it('appends a text overlay to a video section', () => {
    const result = addElement(videoSection(), 'text');

    if (!result) throw new Error('expected a patch');

    expect(field(result.patch, 'overlays')).toHaveLength(1);
    expect(result.ref).toEqual({ kind: 'text', index: 0 });
  });

  it('appends an image overlay to a video section', () => {
    const result = addElement(videoSection(), 'image');

    if (!result) throw new Error('expected a patch');

    expect(field(result.patch, 'images')).toHaveLength(1);
    expect(result.ref).toEqual({ kind: 'image', index: 0 });
  });

  it('appends an image overlay to a color section', () => {
    const result = addElement(newSection('color'), 'image');

    if (!result) throw new Error('expected a patch');

    expect(field(result.patch, 'images')).toHaveLength(1);
    expect(result.ref).toEqual({ kind: 'image', index: 0 });
  });

  it('returns null when the section does not own the array', () => {
    expect(addElement(videoSection(), 'layer')).toBeNull();
    expect(addElement(newSection('music'), 'text')).toBeNull();
  });
});

describe('removeElement', () => {
  it('drops the targeted index from the matching array', () => {
    const section = richColorSection();
    const patch = removeElement(section, { kind: 'text', index: 0 });
    const overlays = field<{ text: string }>(patch, 'overlays');

    expect(overlays).toHaveLength(1);
    expect(overlays?.[0]?.text).toBe('b');
  });
});

describe('reorderElement', () => {
  it('swaps an element with its previous neighbour for delta -1', () => {
    const section = richColorSection();
    const patch = reorderElement(section, { kind: 'text', index: 1 }, -1);
    const overlays = field<{ text: string }>(patch, 'overlays');

    expect(overlays?.[0]?.text).toBe('b');
    expect(overlays?.[1]?.text).toBe('a');
  });

  it('returns an empty no-op patch at the top edge', () => {
    const section = richColorSection();
    const patch = reorderElement(section, { kind: 'text', index: 0 }, -1);

    expect(patch).toEqual({});
  });
});
