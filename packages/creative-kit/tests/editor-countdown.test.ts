import { describe, it, expect } from 'vitest';
import { defaultCountdownFor } from '../src/editor/templateEditorModel';

describe('defaultCountdownFor', () => {
  it('gives a snappy 2s lead-in to short clips (< 5s)', () => {
    expect(defaultCountdownFor(2)).toBe(2);
    expect(defaultCountdownFor(4.9)).toBe(2);
  });

  it('uses the comfortable 3s default for normal clips (5s–30s)', () => {
    expect(defaultCountdownFor(5)).toBe(3);
    expect(defaultCountdownFor(8)).toBe(3);
    expect(defaultCountdownFor(30)).toBe(3);
  });

  it('gives a 4s lead-in to long clips (> 30s)', () => {
    expect(defaultCountdownFor(31)).toBe(4);
    expect(defaultCountdownFor(120)).toBe(4);
  });

  it('falls back to the short default for non-finite / nonsensical input', () => {
    expect(defaultCountdownFor(Number.NaN)).toBe(2);
    expect(defaultCountdownFor(-10)).toBe(2);
    expect(defaultCountdownFor(0)).toBe(2);
  });
});
