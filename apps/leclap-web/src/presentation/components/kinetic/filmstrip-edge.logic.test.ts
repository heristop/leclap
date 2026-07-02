import { describe, expect, it } from 'vitest';
import { holeCount, holeOffsets } from './filmstrip-edge.logic';

describe('holeCount', () => {
  it('fits whole holes into the usable height', () => {
    expect(holeCount(100, 20)).toBe(5);
  });

  it('accounts for the inset band', () => {
    expect(holeCount(100, 20, 10)).toBe(4);
  });

  it('returns 0 for degenerate inputs', () => {
    expect(holeCount(0, 20)).toBe(0);
    expect(holeCount(100, 0)).toBe(0);
    expect(holeCount(10, 20, 10)).toBe(0);
  });
});

describe('holeOffsets', () => {
  it('centres holes within the spacing', () => {
    expect(holeOffsets(60, 20)).toEqual([10, 30, 50]);
  });

  it('starts after the inset', () => {
    expect(holeOffsets(80, 20, 10)).toEqual([20, 40, 60]);
  });
});
