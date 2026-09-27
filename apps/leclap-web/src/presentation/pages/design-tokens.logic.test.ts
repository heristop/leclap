import { describe, expect, it } from 'vitest';
import { bezierPath, durationMs, parseCubicBezier } from './design-tokens.logic';

describe('parseCubicBezier', () => {
  it('reads the four control values of a token', () => {
    expect(parseCubicBezier('cubic-bezier(0.34, 1.56, 0.64, 1)')).toEqual([0.34, 1.56, 0.64, 1]);
  });

  it('tolerates the whitespace a computed style carries', () => {
    expect(parseCubicBezier(' cubic-bezier(0.4,0,0.2,1) ')).toEqual([0.4, 0, 0.2, 1]);
  });

  it('rejects keywords and malformed values', () => {
    expect(parseCubicBezier('ease-in-out')).toBeNull();
    expect(parseCubicBezier('cubic-bezier(0.4, 0, 0.2)')).toBeNull();
    expect(parseCubicBezier('')).toBeNull();
  });
});

describe('bezierPath', () => {
  it('draws the curve in a y-up box of the given size', () => {
    expect(bezierPath([0.4, 0, 0.2, 1], 100)).toBe('M0 100 C40 100 20 0 100 0');
  });

  it('lets an overshooting control point leave the box', () => {
    expect(bezierPath([0.34, 1.56, 0.64, 1], 100)).toBe('M0 100 C34 -56 64 0 100 0');
  });
});

describe('durationMs', () => {
  it('reads seconds and milliseconds', () => {
    expect(durationMs('0.28s')).toBe(280);
    expect(durationMs(' 200ms')).toBe(200);
  });

  it('is null for anything else', () => {
    expect(durationMs('fast')).toBeNull();
    expect(durationMs('')).toBeNull();
  });
});
