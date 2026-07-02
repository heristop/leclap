import { clamp01, arcRadius, circumference, dashOffset, barFill } from '@/src/components/kinetic/gradient-meter.logic';

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

describe('barFill', () => {
  it('scales the width by clamped progress', () => {
    expect(barFill(200, 0.25)).toBe(50);
    expect(barFill(200, -1)).toBe(0);
    expect(barFill(200, 9)).toBe(200);
  });
});
