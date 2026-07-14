import { describe, it, expect } from 'vitest';
import { newSection, newOverlay, type EditorSection, type ImageOverlay } from '../templateEditorModel';
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

describe('shape elements (image overlays carrying a shape recipe)', () => {
  it('gates the shape add on image ownership', () => {
    expect(canAddElement(newSection('color'), 'shapeRect')).toBe(true);
    expect(canAddElement(videoSection(), 'shapeEllipse')).toBe(true);
    expect(canAddElement(newSection('image'), 'shapeRect')).toBe(true);
    expect(canAddElement(newSection('music'), 'shapeRect')).toBe(false);
    expect(canAddElement(newSection('form'), 'shapeEllipse')).toBe(false);
  });

  it('appends a rect shape to the images array with the recipe and a data: PNG choice', () => {
    const result = addElement(newSection('color'), 'shapeRect', 'portrait');

    if (!result) throw new Error('expected a patch');

    const images = field<ImageOverlay>(result.patch, 'images');

    expect(images).toHaveLength(1);
    expect(images?.[0]?.shape).toMatchObject({ kind: 'rect' });
    expect(images?.[0]?.choice).toMatchObject({ source: 'url' });
    expect(result.ref).toEqual({ kind: 'image', index: 0 });
  });

  it('appends an ellipse shape after existing images', () => {
    const section = {
      ...newSection('video'),
      images: [{ id: 'i', choice: { source: 'url', url: '/logo.png' } }],
    } as EditorSection;
    const result = addElement(section, 'shapeEllipse', 'landscape');

    if (!result) throw new Error('expected a patch');

    expect(field<ImageOverlay>(result.patch, 'images')).toHaveLength(2);
    expect(field<ImageOverlay>(result.patch, 'images')?.[1]?.shape?.kind).toBe('ellipse');
    expect(result.ref).toEqual({ kind: 'image', index: 1 });
  });

  it('returns null where the section cannot carry images', () => {
    expect(addElement(newSection('music'), 'shapeRect', 'portrait')).toBeNull();
  });

  it('lists a shape-bearing image as element.shape with its fill colour as the preview', () => {
    const section = {
      ...newSection('color'),
      images: [
        { id: 'a', choice: { source: 'url', url: '/logo.png' } },
        { id: 'b', choice: { source: 'url', url: 'data:image/png;base64,AA' }, shape: { kind: 'rect', color: '#ff4d4d' } },
      ],
    } as EditorSection;
    const rows = listSectionElements(section).filter((d) => d.kind === 'image');

    expect(rows[0].labelKey).toBe('element.image');
    expect(rows[0].previewText).toBe('logo.png');
    expect(rows[1].labelKey).toBe('element.shape');
    expect(rows[1].previewText).toBe('#ff4d4d');
    expect(rows[1].ref).toEqual({ kind: 'image', index: 1 });
  });
});

describe('variable display in previews', () => {
  it('renders {{ variable }} as a #variable chip in text previews', () => {
    const section = {
      ...newSection('color'),
      overlays: [{ ...newOverlay(), text: '{{ form_1_step }}' }],
    } as EditorSection;
    const text = listSectionElements(section).find((d) => d.kind === 'text');

    expect(text?.previewText).toBe('#form_1_step');
  });

  it('leaves curly braces in an asset filename verbatim (not a variable)', () => {
    const section = {
      ...newSection('color'),
      images: [{ id: 'a', choice: { source: 'url', url: '/photo{{2}}.jpg' } }],
    } as EditorSection;
    const image = listSectionElements(section).find((d) => d.kind === 'image');

    expect(image?.previewText).toBe('photo{{2}}.jpg');
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

  it('clears a sugar field instead of splicing an array', () => {
    const section = { ...newSection('video'), lowerThird: { title: { en: 'Jane' } } } as EditorSection;
    const patch = removeElement(section, { kind: 'lowerThird', index: 0 });

    expect('lowerThird' in patch).toBe(true);
    expect((patch as { lowerThird?: unknown }).lowerThird).toBeUndefined();
  });

  it('no-ops for a sugar kind the section cannot carry', () => {
    expect(removeElement(newSection('video'), { kind: 'titleCard', index: 0 })).toEqual({});
  });
});

describe('sugar elements (caption / titleCard / lowerThird)', () => {
  it('lists present sugar after the array elements, as index-0 singletons', () => {
    const section = {
      ...richColorSection(),
      caption: { text: 'A subtitle' },
      titleCard: { headline: { en: 'Big intro' } },
    } as EditorSection;
    const descriptors = listSectionElements(section);

    expect(descriptors.map((d) => d.kind)).toEqual(['layer', 'layer', 'text', 'text', 'animation', 'caption', 'titleCard']);
    expect(descriptors.at(-2)?.ref).toEqual({ kind: 'caption', index: 0 });
    expect(descriptors.at(-2)?.labelKey).toBe('element.caption');
    expect(descriptors.at(-2)?.previewText).toBe('A subtitle');
    expect(descriptors.at(-1)?.labelKey).toBe('element.titleCard');
    expect(descriptors.at(-1)?.previewText).toBe('Big intro');
  });

  it('lists a video lower third with its title as preview', () => {
    const section = { ...newSection('video'), lowerThird: { title: { en: 'Jane Doe' } } } as EditorSection;
    const descriptors = listSectionElements(section);

    expect(descriptors).toEqual([
      {
        ref: { kind: 'lowerThird', index: 0 },
        kind: 'lowerThird',
        labelKey: 'element.lowerThird',
        previewText: 'Jane Doe',
      },
    ]);
  });

  it('lists nothing when a section carries no sugar', () => {
    expect(listSectionElements(newSection('video'))).toEqual([]);
  });

  it('is addable from the add menu only while absent (per-section singleton)', () => {
    expect(canAddElement(newSection('video'), 'lowerThird')).toBe(true);
    expect(canAddElement(newSection('color'), 'titleCard')).toBe(true);
    expect(canAddElement(newSection('video'), 'caption')).toBe(true);
    expect(addElement(newSection('video'), 'caption')).not.toBeNull();
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

  it('returns an empty no-op patch for a sugar ref (sugar is a singleton, not an ordered array)', () => {
    const section = { ...newSection('video'), lowerThird: { title: { en: 'Jane' } } } as EditorSection;

    expect(reorderElement(section, { kind: 'lowerThird', index: 0 }, -1)).toEqual({});
  });

  it('insert-moves across multiple positions (drag-and-drop), shifting the rest', () => {
    const base = newSection('color');

    if (base.kind !== 'color') throw new Error('expected color section');
    const section: EditorSection = {
      ...base,
      overlays: [
        { ...newOverlay(), text: 'a' },
        { ...newOverlay(), text: 'b' },
        { ...newOverlay(), text: 'c' },
      ],
    };

    // Drag 'a' (index 0) to index 2: a proper move yields [b, c, a] — a swap would wrongly give [c, b, a].
    const patch = reorderElement(section, { kind: 'text', index: 0 }, 2);
    const overlays = field<{ text: string }>(patch, 'overlays');

    expect(overlays?.map((o) => o.text)).toEqual(['b', 'c', 'a']);
  });
});

describe('sugar add (caption / titleCard / lowerThird from the + Add menu)', () => {
  it('offers a sugar kind only on its owner sections and only while absent', () => {
    const video = newSection('video');
    const color = newSection('color');

    expect(canAddElement(video, 'caption')).toBe(true);
    expect(canAddElement(video, 'lowerThird')).toBe(true);
    expect(canAddElement(video, 'titleCard')).toBe(false);
    expect(canAddElement(color, 'titleCard')).toBe(true);
    expect(canAddElement(color, 'lowerThird')).toBe(false);
    expect(canAddElement(newSection('music'), 'caption')).toBe(false);

    const withCaption = { ...video, caption: { text: 'x' } } as EditorSection;
    expect(canAddElement(withCaption, 'caption')).toBe(false);
  });

  it('adds a visible default and selects the singleton ref', () => {
    const video = newSection('video');
    const added = addElement(video, 'caption');
    expect(added?.ref).toEqual({ kind: 'caption', index: 0 });
    expect((added?.patch as { caption?: { text: string } } | undefined)?.caption?.text.length).toBeGreaterThan(0);

    const color = newSection('color');
    const card = addElement(color, 'titleCard');
    expect(card?.ref).toEqual({ kind: 'titleCard', index: 0 });

    const third = addElement(video, 'lowerThird');
    expect(third?.ref).toEqual({ kind: 'lowerThird', index: 0 });
  });

  it('refuses to add sugar where unowned or already present', () => {
    expect(addElement(newSection('video'), 'titleCard')).toBeNull();
    const withCaption = { ...newSection('video'), caption: { text: 'x' } } as EditorSection;
    expect(addElement(withCaption, 'caption')).toBeNull();
  });
});
