import { describe, it, expect } from 'vitest';
import { parseColor, compositeOver, relativeLuminance, contrastRatio, rgbToHex } from '@/core/color-contrast';

describe('parseColor', () => {
  it('parses a 6-digit hex token', () => {
    expect(parseColor('#f5f5f0')).toEqual({ rgb: { r: 0xf5, g: 0xf5, b: 0xf0 }, alpha: 1 });
  });

  it('parses a 3-digit hex token, doubling each digit', () => {
    expect(parseColor('#fff')).toEqual({ rgb: { r: 255, g: 255, b: 255 }, alpha: 1 });
  });

  it('parses an @alpha suffix', () => {
    expect(parseColor('#141416@0.8')).toEqual({ rgb: { r: 0x14, g: 0x14, b: 0x16 }, alpha: 0.8 });
  });

  it('parses common named colours', () => {
    expect(parseColor('black')).toEqual({ rgb: { r: 0, g: 0, b: 0 }, alpha: 1 });
    expect(parseColor('white')).toEqual({ rgb: { r: 255, g: 255, b: 255 }, alpha: 1 });
  });

  it('is case-insensitive for hex and named tokens', () => {
    expect(parseColor('#FFFFFF')).toEqual({ rgb: { r: 255, g: 255, b: 255 }, alpha: 1 });
    expect(parseColor('WHITE')).toEqual({ rgb: { r: 255, g: 255, b: 255 }, alpha: 1 });
  });

  it('returns null for an unrecognised token', () => {
    expect(parseColor('cornflowerblue')).toBeNull();
    expect(parseColor('not-a-colour')).toBeNull();
  });

  it('returns null for a templated variable rather than guessing', () => {
    expect(parseColor('{{ accent }}')).toBeNull();
  });

  it('returns null for a non-numeric alpha suffix', () => {
    expect(parseColor('#000000@oops')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black against white, the WCAG maximum', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it('is 1:1 for identical colours', () => {
    const grey = { r: 100, g: 120, b: 140 };

    expect(contrastRatio(grey, grey)).toBeCloseTo(1, 10);
  });

  it('is order-independent', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 255, g: 255, b: 255 };

    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });

  it('matches a known mid-pair verified by hand: #333333 on #1a1a1a is ~1.4:1', () => {
    const a = { r: 0x33, g: 0x33, b: 0x33 };
    const b = { r: 0x1a, g: 0x1a, b: 0x1a };

    expect(contrastRatio(a, b)).toBeCloseTo(1.3775, 4);
  });
});

describe('compositeOver', () => {
  it('composites a half-opacity black box over white to mid-grey', () => {
    const result = compositeOver({ rgb: { r: 0, g: 0, b: 0 }, alpha: 0.5 }, { r: 255, g: 255, b: 255 });

    expect(result).toEqual({ r: 127.5, g: 127.5, b: 127.5 });
  });

  it('leaves an opaque paint unchanged regardless of the background', () => {
    const fg = { rgb: { r: 10, g: 20, b: 30 }, alpha: 1 };

    expect(compositeOver(fg, { r: 200, g: 200, b: 200 })).toEqual({ r: 10, g: 20, b: 30 });
  });
});

describe('rgbToHex', () => {
  it('formats and round-trips through parseColor', () => {
    const hex = rgbToHex({ r: 127.5, g: 127.5, b: 127.5 });

    expect(hex).toBe('#808080');
    expect(parseColor(hex)?.rgb).toEqual({ r: 128, g: 128, b: 128 });
  });
});
