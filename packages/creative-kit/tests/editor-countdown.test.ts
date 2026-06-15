import { describe, it, expect } from 'vitest';
import { defaultCountdownFor } from '../src/editor/templateEditorModel';

describe('defaultCountdownFor', () => {
  it('gives a snappy 3s lead-in to short clips (< 5s)', () => {
    expect(defaultCountdownFor(2)).toBe(3);
    expect(defaultCountdownFor(4.9)).toBe(3);
  });

  it('uses the comfortable 4s default for normal clips (5s–30s)', () => {
    expect(defaultCountdownFor(5)).toBe(4);
    expect(defaultCountdownFor(8)).toBe(4);
    expect(defaultCountdownFor(30)).toBe(4);
  });

  it('gives a 5s lead-in to long clips (> 30s)', () => {
    expect(defaultCountdownFor(31)).toBe(5);
    expect(defaultCountdownFor(120)).toBe(5);
  });

  it('falls back to the short default for non-finite / nonsensical input', () => {
    expect(defaultCountdownFor(Number.NaN)).toBe(3);
    expect(defaultCountdownFor(-10)).toBe(3);
    expect(defaultCountdownFor(0)).toBe(3);
  });
});
