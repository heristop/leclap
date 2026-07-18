import { describe, it, expect } from 'vitest';
import { DEFAULT_TRANSITION_DURATION, MAX_TRANSITION_DURATION, TransitionSchema } from '@/schemas/effects.schemas';

// The transition duration bounds are shared with the editor UI (the picker's slider max and the
// chip's inherited-duration fallback) — they MUST stay in lockstep with the schema or the UI
// clamps valid descriptors / misstates what an inherited boundary renders.
describe('transition duration constants', () => {
  it('defaults to 0.3s when neither the section nor the global transition declares one', () => {
    expect(DEFAULT_TRANSITION_DURATION).toBe(0.3);
  });

  it('caps the duration at 5s, matching the schema bound', () => {
    expect(MAX_TRANSITION_DURATION).toBe(5);
    expect(TransitionSchema.safeParse({ type: 'fade', duration: MAX_TRANSITION_DURATION }).success).toBe(true);
    expect(TransitionSchema.safeParse({ type: 'fade', duration: MAX_TRANSITION_DURATION + 0.1 }).success).toBe(false);
  });

  it('rejects non-positive durations', () => {
    expect(TransitionSchema.safeParse({ type: 'fade', duration: 0 }).success).toBe(false);
  });
});
