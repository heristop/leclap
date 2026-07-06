import { describe, expect, it } from 'vitest';
import { showWindowSeconds } from './image-show-window';

describe('showWindowSeconds', () => {
  it('returns the seconds value when positive', () => {
    expect(showWindowSeconds(2)).toBe(2);
  });

  it('trims float noise from stepper arithmetic', () => {
    expect(showWindowSeconds(0.1 + 0.2)).toBe(0.3);
  });

  it('normalizes zero to undefined (untimed = whole scene)', () => {
    expect(showWindowSeconds(0)).toBeUndefined();
  });

  it('normalizes negative values to undefined', () => {
    expect(showWindowSeconds(-1)).toBeUndefined();
  });

  it('normalizes NaN to undefined', () => {
    expect(showWindowSeconds(Number.NaN)).toBeUndefined();
  });
});
