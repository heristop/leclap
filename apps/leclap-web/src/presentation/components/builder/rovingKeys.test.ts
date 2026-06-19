import { describe, it, expect } from 'vitest';
import { arrowTarget } from './rovingKeys';

describe('arrowTarget', () => {
  it('moves forward and wraps at the end', () => {
    expect(arrowTarget('ArrowRight', 0, 2)).toBe(1);
    expect(arrowTarget('ArrowDown', 1, 2)).toBe(2);
    expect(arrowTarget('ArrowRight', 2, 2)).toBe(0);
  });
  it('moves backward and wraps at the start', () => {
    expect(arrowTarget('ArrowLeft', 2, 2)).toBe(1);
    expect(arrowTarget('ArrowUp', 0, 2)).toBe(2);
  });
  it('jumps to Home and End', () => {
    expect(arrowTarget('Home', 2, 2)).toBe(0);
    expect(arrowTarget('End', 0, 2)).toBe(2);
  });
  it('returns -1 for keys it does not handle', () => {
    expect(arrowTarget('Enter', 0, 2)).toBe(-1);
  });
});
