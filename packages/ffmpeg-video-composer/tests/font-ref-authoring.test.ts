import { describe, it, expect } from 'vitest';
import { resolveFontFile } from '@/editor/presets/text';
import { CaptionSchema } from '@/schemas/text.schemas';
import { TemplateValidator } from '@/services/TemplateValidator';

// `font` accepts a registry id, a raw .ttf filename, or a FontRef naming any family. The first two
// must behave exactly as before — a font named by family is purely additive.
describe('resolveFontFile', () => {
  it('still maps a registry id to its bundled file', () => {
    expect(resolveFontFile('bebas', 'Oswald.ttf')).toBe('BebasNeue.ttf');
  });

  it('still passes a raw ttf filename through', () => {
    expect(resolveFontFile('Anton.ttf', 'Oswald.ttf')).toBe('Anton.ttf');
  });

  it('still falls back to the preset font when unset', () => {
    expect(resolveFontFile(undefined, 'Oswald.ttf')).toBe('Oswald.ttf');
  });

  it('passes a FontRef through untouched for the formatter to slug', () => {
    expect(resolveFontFile({ family: 'Inter', weight: 700 }, 'Oswald.ttf')).toEqual({
      family: 'Inter',
      weight: 700,
    });
  });
});

describe('CaptionSchema font', () => {
  const base = { text: { en: 'hi' } };

  it('accepts a registry id', () => {
    expect(CaptionSchema.safeParse({ ...base, font: 'bebas' }).success).toBe(true);
  });

  it('accepts a family with a weight', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter', weight: 700 } }).success).toBe(true);
  });

  it('accepts a family on its own', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter' } }).success).toBe(true);
  });

  it('accepts an italic style', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter', style: 'italic' } }).success).toBe(true);
  });

  it('rejects an empty family', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: '  ' } }).success).toBe(false);
  });

  it('rejects a weight that is not a Google Fonts step', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter', weight: 650 } }).success).toBe(false);
  });

  it('rejects a weight outside 100..900', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter', weight: 1000 } }).success).toBe(false);
  });

  it('rejects an unknown style', () => {
    expect(CaptionSchema.safeParse({ ...base, font: { family: 'Inter', style: 'oblique' } }).success).toBe(false);
  });
});

// The unknown_font rule guards registry ids so a typo stays a local error. A FontRef names a family
// that is resolved at render time, so the rule must let it through rather than flagging it.
describe('unknown_font validation', () => {
  function templateWithCaptionFont(font: unknown) {
    return {
      name: 'test',
      sections: [{ name: 's', type: 'video', options: { duration: 2 }, caption: { text: { en: 'hi' }, font } }],
    };
  }

  it('flags a misspelled registry id', () => {
    const result = new TemplateValidator().validateTemplate(templateWithCaptionFont('bebbas'));
    expect(result.errors?.some((issue) => issue.code === 'unknown_font')).toBe(true);
  });

  it('does not flag a font named by family', () => {
    const result = new TemplateValidator().validateTemplate(templateWithCaptionFont({ family: 'Inter', weight: 700 }));
    expect(result.errors?.some((issue) => issue.code === 'unknown_font') ?? false).toBe(false);
  });
});
