import { describe, it, expect } from 'vitest';
import { RATE_STOPS, NORMAL_RATE_INDEX, rateFromSpeed, speedFromRate, nearestRateIndex, formatRate } from './speedRate';

describe('rateFromSpeed / speedFromRate', () => {
  it('inverts the PTS multiplier into a user-facing rate', () => {
    expect(rateFromSpeed(0.5)).toBe(2); // speed 0.5 → plays twice as fast
    expect(rateFromSpeed(2)).toBe(0.5); // speed 2 → slow motion
    expect(rateFromSpeed(undefined)).toBe(1);
  });

  it('maps normal rate to unset and inverts the rest', () => {
    expect(speedFromRate(1)).toBeUndefined();
    expect(speedFromRate(2)).toBe(0.5);
    expect(speedFromRate(0.25)).toBe(4);
  });

  it('round-trips every stop', () => {
    for (const rate of RATE_STOPS) {
      expect(rateFromSpeed(speedFromRate(rate))).toBeCloseTo(rate, 10);
    }
  });

  it('guards nonsense values', () => {
    expect(rateFromSpeed(0)).toBe(1);
    expect(rateFromSpeed(-2)).toBe(1);
    expect(speedFromRate(0)).toBeUndefined();
  });
});

describe('nearestRateIndex', () => {
  it('finds exact stops', () => {
    expect(RATE_STOPS[nearestRateIndex(2)]).toBe(2);
    expect(nearestRateIndex(1)).toBe(NORMAL_RATE_INDEX);
  });

  it('snaps odd imported rates to the closest stop', () => {
    expect(RATE_STOPS[nearestRateIndex(0.7)]).toBe(0.75);
    expect(RATE_STOPS[nearestRateIndex(2.4)]).toBe(2);
    expect(RATE_STOPS[nearestRateIndex(10)]).toBe(4);
  });
});

describe('formatRate', () => {
  it('trims trailing zeros', () => {
    expect(formatRate(0.75)).toBe('0.75×');
    expect(formatRate(2)).toBe('2×');
    expect(formatRate(1.5)).toBe('1.5×');
  });
});
