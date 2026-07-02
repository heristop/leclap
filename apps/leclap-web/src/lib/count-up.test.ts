import { describe, it, expect } from 'vitest';
import { parseCount, easeOutExpo, countAtProgress, formatCount } from './count-up';

describe('parseCount', () => {
  it('splits a percentage into number + suffix', () => {
    expect(parseCount('100%')).toEqual({ target: 100, prefix: '', suffix: '%', decimals: 0 });
  });

  it('parses a bare integer', () => {
    expect(parseCount('0')).toEqual({ target: 0, prefix: '', suffix: '', decimals: 0 });
  });

  it('keeps a trailing unit as the suffix', () => {
    expect(parseCount('1.5K+')).toEqual({ target: 1.5, prefix: '', suffix: 'K+', decimals: 1 });
  });

  it('captures a leading symbol as the prefix', () => {
    expect(parseCount('$42')).toEqual({ target: 42, prefix: '$', suffix: '', decimals: 0 });
  });

  it('returns a null target for a non-numeric value', () => {
    expect(parseCount('∞')).toEqual({ target: null, prefix: '∞', suffix: '', decimals: 0 });
  });
});

describe('easeOutExpo', () => {
  it('clamps to the 0..1 endpoints', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(-0.5)).toBe(0);
    expect(easeOutExpo(2)).toBe(1);
  });

  it('decelerates (past the midpoint by half-time)', () => {
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.5);
  });
});

describe('countAtProgress', () => {
  it('starts at 0 and lands on the target', () => {
    expect(countAtProgress(100, 0)).toBe(0);
    expect(countAtProgress(100, 1)).toBe(100);
  });

  it('rounds to the requested decimals', () => {
    expect(countAtProgress(1.5, 1, 1)).toBe(1.5);
    expect(Number.isInteger(countAtProgress(100, 0.37))).toBe(true);
  });
});

describe('formatCount', () => {
  it('reassembles prefix + number + suffix', () => {
    expect(formatCount(parseCount('100%'), 63)).toBe('63%');
    expect(formatCount(parseCount('1.5K+'), 0.8)).toBe('0.8K+');
  });
});
