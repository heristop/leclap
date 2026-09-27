import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectGeometryWarnings } from '@/services/geometry';
import { canvasFor, collectBoxes } from '@/services/geometry/text-boxes';
import type { FontMetrics } from '@/core/font-metrics';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

// Each case pins the model to what the renderer actually draws — the string FormatterManager hands
// drawtext, where captions.ts pins a caption, what paints behind it — measured with the real fonts.
const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '../../leclap-creative-kit/src/library/fonts');
const halfEm: FontMetrics = { unitsPerEm: 1000, advanceWidth: () => 500 };

async function loadFont(fontFile: string): Promise<Uint8Array | null> {
  try {
    return readFileSync(join(fontsDir, fontFile));
  } catch {
    return null;
  }
}

function descriptor(section: Record<string, unknown>, global: Record<string, unknown> = {}): TemplateDescriptor {
  return {
    global: { orientation: 'landscape', ...global },
    sections: [{ type: 'video', name: 'a', options: { duration: 3 }, ...section }],
  } as unknown as TemplateDescriptor;
}

async function codes(template: TemplateDescriptor): Promise<string[]> {
  return (await collectGeometryWarnings(template, loadFont)).map((warning) => warning.code);
}

describe('title-safe findings on preset-pinned edges', () => {
  // The default `bar` box reaches 18px outside the preset's fixed 80px margin: 62px from the frame
  // edge against a 64px landscape inset, whatever the text says. "Shorten it" cannot move that edge.
  it.each(['left', 'right'])('does not flag a short %s-aligned caption', async (align) => {
    expect(await codes(descriptor({ caption: { text: { en: 'Chapter One' }, align } }))).toEqual([]);
  });

  it('still flags a left-aligned caption that runs off the right-hand side', async () => {
    const text = { en: 'A left-aligned caption that keeps going until it runs past the right-hand margin' };

    expect(await codes(descriptor({ caption: { text, align: 'left' } }))).toEqual(['text_out_of_frame']);
  });
});

describe('multi-line text', () => {
  // drawtext breaks lines at '\n': the box is as wide as the widest line and one line taller per
  // break. Measured as a single run, two lines that each fit were reported off the frame.
  it('measures the widest line, not the lines laid end to end', async () => {
    const text = { en: 'A reasonably long first line of text\nand a second one here' };

    expect(await codes(descriptor({ caption: { text } }))).toEqual([]);
  });

  it('stacks one line of height per break, from the anchored bottom edge', () => {
    const boxesFor = (en: string) =>
      collectBoxes(descriptor({ caption: { text: { en } } }), canvasFor('landscape'), () => halfEm);
    const [one] = boxesFor('ab');
    const [three] = boxesFor('ab\ncd\nef');

    // The default `bar` caption: 46px type, 1.2em per line, pinned by its bottom edge.
    expect(three.height - one.height).toBeCloseTo(2 * 46 * 1.2, 5);
    expect(three.width).toBeCloseTo(one.width, 5);
    expect(three.y + three.height).toBeCloseTo(one.y + one.height, 5);
  });
});

describe('the string drawtext receives', () => {
  const wide = 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww';

  // formatText applies upperCase and THEN lowerCase, so a section setting both draws lowercase.
  it('lets lowerCase win when a section sets both case options', async () => {
    const both = descriptor({
      options: { duration: 3, upperCase: true, lowerCase: true },
      caption: { text: { en: wide } },
    });
    const lower = descriptor({ options: { duration: 3, lowerCase: true }, caption: { text: { en: wide } } });

    expect(await codes(both)).toEqual(await codes(lower));
  });

  // formatText swaps straight quotes for typographic ones, wider in every bundled face but
  // BebasNeue: this caption fits as typed and crosses the title-safe margin as drawn.
  it('measures the typographic quotes formatText draws', async () => {
    const text = { en: "L'équipe d'aujourd'hui n'est qu'à l'aube d'une idée neuve et plus vive" };

    expect(await codes(descriptor({ caption: { text } }))).toContain('text_overflow');
  });

  // `global.variables` are fixed by the descriptor and substituted before drawing, so a caption made
  // of one is measured as the text it becomes, not as the placeholder.
  it('substitutes the descriptor’s own variables before measuring', async () => {
    const headline = 'An extremely long headline that is far too wide for the frame at this size';
    const viaVariable = descriptor(
      { caption: { text: { en: '{{ headline }}' }, fontsize: 72 } },
      { variables: { headline } }
    );
    const literal = descriptor({ caption: { text: { en: headline }, fontsize: 72 } });

    expect(await codes(viaVariable)).toContain('text_out_of_frame');
    expect(await collectGeometryWarnings(viaVariable, loadFont)).toEqual(
      await collectGeometryWarnings(literal, loadFont)
    );
  });

  // Nothing substitutes variables into `fontfile`: a templated font renders in the style preset's
  // face, so that is the face it is measured in — not a 0.5em estimate flagged approximate.
  it('measures a templated font id in the preset face the render falls back to', async () => {
    const text = { en: 'A caption of about fifty characters, give or take' };
    const templated = await collectGeometryWarnings(
      descriptor({ caption: { text, font: '{{ brandFont }}' } }),
      loadFont
    );
    const preset = await collectGeometryWarnings(descriptor({ caption: { text } }), loadFont);

    expect(templated).toEqual(preset);
  });
});

describe('what the text is drawn over', () => {
  const white = { type: 'color_background', options: { duration: 3, backgroundColor: '#ffffff' } };
  const whiteCaption = { text: { en: 'Hi' }, style: 'subtle', color: '#ffffff' };

  it('scores contrast against a bare colour card', async () => {
    expect(await codes(descriptor({ ...white, caption: whiteCaption }))).toEqual(['text_low_contrast']);
  });

  // An image input, an authored full-frame fill, or a grade all repaint the card before the caption
  // is drawn, so its `backgroundColor` says nothing about what the text sits on.
  it.each([
    ['an image input', { inputs: [{ name: 'photo', type: 'image', url: 'pictures/photo.png' }] }],
    ['a section grade', { grade: { brightness: -0.6 } }],
  ])('treats the backdrop as unknown under %s', async (_, cover) => {
    expect(await codes(descriptor({ ...white, ...cover, caption: whiteCaption }))).toEqual([
      'text_unreadable_over_footage',
    ]);
  });

  // An authored drawbox is one of the filters the model reads: white text on a full-frame black fill
  // is legible, and the section's white background underneath no longer matters.
  it('reads an authored fill as the backdrop', async () => {
    const fill = { filters: [{ type: 'drawbox', values: { x: 0, y: 0, w: 'iw', h: 'ih', c: '#000000', t: 'fill' } }] };

    expect(await codes(descriptor({ ...white, ...fill, caption: whiteCaption }))).toEqual([]);
  });

  it('treats the backdrop as unknown under a template-wide grade', async () => {
    const graded = descriptor({ ...white, caption: whiteCaption }, { grade: { brightness: -0.6 } });

    expect(await codes(graded)).toEqual(['text_unreadable_over_footage']);
  });

  // applyTextEffect draws nothing for a zero offset or width, or a transparent colour — like a
  // `boxOpacity: 0` box, none of them is a legibility aid.
  it.each([
    ['a zero-width outline', { outline: { width: 0 } }],
    ['a zero-offset shadow', { shadow: { dx: 0, dy: 0 } }],
    ['a transparent shadow', { shadow: { color: '#000000@0' } }],
  ])('does not count %s as a legibility aid', async (_, effect) => {
    const caption = { text: { en: 'Hi there' }, style: 'subtle', effect };

    expect(await codes(descriptor({ caption }))).toEqual(['text_unreadable_over_footage']);
  });

  it('still counts the default shadow as a legibility aid', async () => {
    const caption = { text: { en: 'Hi there' }, style: 'subtle', effect: { shadow: true } };

    expect(await codes(descriptor({ caption }))).toEqual([]);
  });
});

describe('where a finding points', () => {
  const long = 'A caption far too long to fit in the frame at this size';
  const card = {
    type: 'color_background',
    name: 'card',
    options: { duration: 3 },
    caption: { text: { en: long }, fontsize: 96 },
  };

  // Expansion discards anything set on the `{ type: "partial" }` ref itself, so the only place the
  // author can change a partial's caption is the partial's own entry.
  it('addresses a registry partial’s caption inside the partial', async () => {
    const template = { partials: [{ id: 'intro', sections: [card] }], sections: [{ type: 'partial', ref: 'intro' }] };
    const [warning] = await collectGeometryWarnings(template as unknown as TemplateDescriptor, loadFont);

    expect(warning.path).toBe('partials[0].sections[0].caption');
  });

  it('addresses an inline partial’s caption inside the ref’s own sections', async () => {
    const plain = { type: 'color_background', name: 'plain', options: { duration: 1 } };
    const template = { sections: [plain, { type: 'partial', sections: [plain, card] }] };
    const [warning] = await collectGeometryWarnings(template as unknown as TemplateDescriptor, loadFont);

    expect(warning.path).toBe('sections[1].sections[1].caption');
  });
});
