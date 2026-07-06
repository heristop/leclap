import { describe, it, expect } from 'vitest';
import { effectiveBoundary, boundaryPick, hasNonCutDefault } from './default-transition.logic';

describe('effectiveBoundary', () => {
  it('uses the boundary override when one is set', () => {
    const effective = effectiveBoundary({ type: 'wipeleft', duration: 0.4 }, { type: 'fade', duration: 1 });
    expect(effective).toEqual({ type: 'wipeleft', duration: 0.4, fromDefault: false });
  });

  it('falls back to the template default when the boundary is unset', () => {
    const effective = effectiveBoundary(undefined, { type: 'fade', duration: 1 });
    expect(effective).toEqual({ type: 'fade', duration: 1, fromDefault: true });
  });

  it('treats a cut default as a plain cut, not a highlighted default', () => {
    const effective = effectiveBoundary(undefined, { type: 'cut', duration: 0.5 });
    expect(effective).toEqual({ type: 'cut', duration: 0.5, fromDefault: false });
  });

  it('is a hard cut when neither the boundary nor a default is set', () => {
    expect(effectiveBoundary(undefined, undefined)).toEqual({ type: 'cut', duration: 0.5, fromDefault: false });
  });

  it('keeps an explicit cut override over a non-cut default', () => {
    const effective = effectiveBoundary({ type: 'cut', duration: 0.5 }, { type: 'fade', duration: 1 });
    expect(effective).toMatchObject({ type: 'cut', fromDefault: false });
  });

  it('fills a missing override duration from the default', () => {
    const effective = effectiveBoundary({ type: 'fade' }, { type: 'wipeleft', duration: 0.8 });
    expect(effective.duration).toBe(0.8);
  });
});

describe('boundaryPick', () => {
  it('clears the override when picking cut with no non-cut default (keeps descriptors lean)', () => {
    expect(boundaryPick('cut', 0.5, undefined)).toBeUndefined();
    expect(boundaryPick('cut', 0.5, { type: 'cut', duration: 0.5 })).toBeUndefined();
  });

  it('writes an explicit cut override when the template default is non-cut', () => {
    expect(boundaryPick('cut', 0.5, { type: 'fade', duration: 1 })).toEqual({ type: 'cut', duration: 0.5 });
  });

  it('clears the override when picking the template-default tile', () => {
    expect(boundaryPick('default', 0.5, { type: 'fade', duration: 1 })).toBeUndefined();
  });

  it('writes the picked transition with the current duration', () => {
    expect(boundaryPick('circleopen', 0.7, { type: 'fade', duration: 1 })).toEqual({
      type: 'circleopen',
      duration: 0.7,
    });
  });
});

describe('hasNonCutDefault', () => {
  it('is true only for a set, non-cut default', () => {
    expect(hasNonCutDefault(undefined)).toBe(false);
    expect(hasNonCutDefault({ type: 'cut', duration: 0.5 })).toBe(false);
    expect(hasNonCutDefault({ type: 'fade', duration: 0.5 })).toBe(true);
  });
});
