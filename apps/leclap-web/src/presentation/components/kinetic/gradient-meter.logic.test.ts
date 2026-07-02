import { describe, expect, it } from 'vitest';
import { clamp01, arcRadius, circumference, dashOffset, barPct, ratio01, showShimmer } from './gradient-meter.logic';

describe('clamp01', () => {
  it('clamps below 0 and above 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });
});

describe('arcRadius / circumference', () => {
  it('keeps the stroke within the box', () => {
    expect(arcRadius(188, 9)).toBe(89.5);
  });

  it('computes the circumference from the radius', () => {
    expect(circumference(10)).toBeCloseTo(62.83, 2);
  });
});

describe('dashOffset', () => {
  const circ = circumference(arcRadius(100, 10));

  it('is the full circumference at 0 progress (nothing drawn)', () => {
    expect(dashOffset(circ, 0)).toBeCloseTo(circ, 5);
  });

  it('is 0 at full progress (fully drawn)', () => {
    expect(dashOffset(circ, 1)).toBeCloseTo(0, 5);
  });

  it('clamps out-of-range progress', () => {
    expect(dashOffset(circ, 2)).toBeCloseTo(0, 5);
  });
});

describe('barPct', () => {
  it('scales to a clamped percentage', () => {
    expect(barPct(0.25)).toBe(25);
    expect(barPct(-1)).toBe(0);
    expect(barPct(9)).toBe(100);
  });
});

describe('ratio01', () => {
  it('is the clamped value/total ratio', () => {
    expect(ratio01(1, 4)).toBe(0.25);
    expect(ratio01(4, 4)).toBe(1);
    expect(ratio01(9, 4)).toBe(1);
  });

  it('is 0 when the total is zero or negative (no divide-by-zero)', () => {
    expect(ratio01(3, 0)).toBe(0);
    expect(ratio01(3, -2)).toBe(0);
  });
});

describe('showShimmer', () => {
  it('rides an opted-in fill that is still in progress', () => {
    expect(showShimmer(true, false, 0.5)).toBe(true);
  });

  it('is off when not opted in', () => {
    expect(showShimmer(false, false, 0.5)).toBe(false);
  });

  it('is suppressed in the success state', () => {
    expect(showShimmer(true, true, 0.5)).toBe(false);
  });

  it('is suppressed once full (including out-of-range progress)', () => {
    expect(showShimmer(true, false, 1)).toBe(false);
    expect(showShimmer(true, false, 1.4)).toBe(false);
  });
});
