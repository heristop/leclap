import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectGeometryWarnings } from '@/services/geometry';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

// The model reads what the renderer's own lowerings emit, so every preset is measured — including the
// ones the old hand-kept mirror never covered.

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '../../leclap-creative-kit/src/library/fonts');

const loadFont = async (file: string): Promise<Uint8Array | null> => {
  try {
    return readFileSync(join(fontsDir, file));
  } catch {
    return null;
  }
};

function template(sections: unknown[], global: Record<string, unknown> = {}): TemplateDescriptor {
  return { global: { orientation: 'landscape', ...global }, sections } as unknown as TemplateDescriptor;
}

const card = (extra: Record<string, unknown>) => ({
  type: 'color_background',
  name: 'card',
  options: { duration: 4, backgroundColor: '#101010' },
  ...extra,
});

describe('presets measured from their own filters', () => {
  it('catches a title-card headline that runs off the frame', async () => {
    const headline = { en: 'A headline far too long for any frame at this size, and then some more' };
    const warnings = await collectGeometryWarnings(template([card({ titleCard: { headline } })]), loadFont);

    expect(warnings.map((w) => [w.path, w.code])).toContainEqual([
      'sections[0].titleCard.headline',
      'text_out_of_frame',
    ]);
  });

  // The badge is right-aligned at the title's height, so a long title runs into it.
  it('measures the lower-third badge', async () => {
    const lowerThird = {
      title: { en: 'A lower-third title that keeps going and going and going, on and on, until the badge' },
      badge: { en: '$49' },
    };
    const warnings = await collectGeometryWarnings(template([card({ lowerThird })]), loadFont);
    const collision = warnings.find((w) => w.code === 'text_collision');

    expect(collision?.message).toContain('lower third badge');
  });

  it('reports a caption drawn under a lower-third band', async () => {
    const warnings = await collectGeometryWarnings(
      template([card({ caption: { text: { en: 'Hi' }, position: 'bottom' }, lowerThird: { title: { en: 'Name' } } })]),
      loadFont
    );

    expect(warnings).toContainEqual(
      expect.objectContaining({ path: 'sections[0].caption', code: 'text_covered', approx: false })
    );
  });

  it('reports a global overlay once, not once per section', async () => {
    const overlays = [
      { text: { en: 'A watermark long enough to leave the title-safe area' }, position: 'top', size: 80 },
    ];
    const warnings = await collectGeometryWarnings(template([card({}), card({ name: 'two' })], { overlays }), loadFont);
    const overlayFindings = warnings.filter((w) => w.path === 'global.overlays[0]');

    expect(overlayFindings).toHaveLength(1);
  });
});

describe('findings say what to change', () => {
  it('gives centred text the total it must lose, not one side', async () => {
    const warnings = await collectGeometryWarnings(
      template([
        card({ caption: { text: { en: 'This caption is far too long to fit inside the frame' }, fontsize: 90 } }),
      ]),
      loadFont
    );
    const offFrame = warnings.find((w) => w.code === 'text_out_of_frame');

    expect(offFrame?.message).toMatch(/is ~\d+px too wide for the frame — shorten it or reduce the size$/);
  });

  it('says how many findings were left out', async () => {
    const tiny = { text: { en: 'tiny' }, fontsize: 8 };
    const sections = Array.from({ length: 25 }, (_, i) => card({ name: `s${i}`, caption: tiny }));
    const warnings = await collectGeometryWarnings(template(sections), loadFont);

    expect(warnings).toHaveLength(20);
    expect(warnings.at(-1)).toMatchObject({ code: 'geometry_truncated', path: 'template' });
    expect(warnings.at(-1)?.message).toContain('6 more');
  });
});

describe('approximate findings say why', () => {
  it('blames the font when no metrics are available', async () => {
    const warnings = await collectGeometryWarnings(
      template([
        card({ caption: { text: { en: 'This caption is far too long to fit inside the frame' }, fontsize: 90 } }),
      ])
    );

    expect(warnings[0]).toMatchObject({ approx: true, approxReason: 'font' });
  });

  it('blames an assumed duration for a collision', async () => {
    const section = {
      type: 'color_background',
      name: 'a',
      caption: { text: { en: 'hello there' }, fontsize: 40, align: 'left', position: 'bottom' },
      lowerThird: { title: { en: 'World' }, subtitle: { en: 'subtitle line' } },
    };
    const collision = (await collectGeometryWarnings(template([section]), loadFont)).find(
      (w) => w.code === 'text_collision'
    );

    expect(collision).toMatchObject({ approx: true, approxReason: 'duration' });
  });
});

describe('what a finding can know', () => {
  // A placeholder's width depends on a value only known at render time; measuring its NAME made the
  // finding depend on what the variable was called. Only the literal text counts — a lower bound.
  it('does not measure a variable by the length of its name', async () => {
    const headline = { en: '{{ form_1_a_very_long_variable_name_for_the_product }}' };
    const warnings = await collectGeometryWarnings(template([card({ titleCard: { headline } })]), loadFont);

    expect(warnings.filter((w) => w.code === 'text_out_of_frame' || w.code === 'text_overflow')).toEqual([]);
  });

  it('still reports literal text around a variable that is already too long', async () => {
    const headline = { en: 'Meet the most extraordinary product ever launched anywhere: {{ product }}' };
    const warnings = await collectGeometryWarnings(template([card({ titleCard: { headline } })]), loadFont);

    expect(warnings).toContainEqual(
      expect.objectContaining({ path: 'sections[0].titleCard.headline', approxReason: 'variable' })
    );
  });

  it('does not call a discreet watermark too small', async () => {
    const overlays = [{ text: { en: '© LeClap' }, size: 10, effect: { shadow: true } }];
    const warnings = await collectGeometryWarnings(template([card({})], { overlays }), loadFont);

    expect(warnings.filter((w) => w.code === 'text_too_small')).toEqual([]);
  });
});
