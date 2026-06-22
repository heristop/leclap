import { describe, it, expect } from 'vitest';
import { scrubValue } from './useScrub';

const base = { start: 10, step: 1, min: 0, max: 100, pxPerStep: 6 } as const;

describe('scrubValue', () => {
  it('increases when dragging right and decreases when dragging left', () => {
    expect(scrubValue({ ...base, deltaX: 60 })).toBe(20);
    expect(scrubValue({ ...base, deltaX: -60 })).toBe(0);
  });

  it('rounds to the nearest step', () => {
    // 3px at 6px/step is half a step → rounds to nearest (start + 0.5 → 11 with banker-free round)
    expect(scrubValue({ ...base, deltaX: 3 })).toBe(11);
    expect(scrubValue({ ...base, deltaX: 2 })).toBe(10);
  });

  it('respects a non-unit step', () => {
    expect(scrubValue({ start: 10, step: 5, min: 0, max: 100, pxPerStep: 6, deltaX: 60 })).toBe(60);
  });

  it('clamps to min and max', () => {
    expect(scrubValue({ ...base, deltaX: 6000 })).toBe(100);
    expect(scrubValue({ ...base, deltaX: -6000 })).toBe(0);
  });

  it('applies the fine modifier (Shift = 0.25x)', () => {
    // 60px → +10 steps at 1x → +2.5 → rounds to +3 (clamped not needed)
    expect(scrubValue({ ...base, deltaX: 60, modifier: 'fine' })).toBe(13);
  });

  it('applies the coarse modifier (Alt = 4x)', () => {
    expect(scrubValue({ ...base, deltaX: 6, modifier: 'coarse' })).toBe(14);
  });

  it('honours pxPerStep sensitivity', () => {
    expect(scrubValue({ start: 0, step: 1, min: 0, max: 100, pxPerStep: 12, deltaX: 60 })).toBe(5);
  });

  it('defaults pxPerStep when omitted', () => {
    expect(scrubValue({ start: 0, step: 1, min: 0, max: 100, deltaX: 60 })).toBe(10);
  });
});
