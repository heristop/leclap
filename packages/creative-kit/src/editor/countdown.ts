// Pure countdown heuristics for project_video sections. The recording countdown
// (before the camera rolls) should feel proportional to the clip: a quick
// answer shouldn't sit behind a long lead-in, while a longer take can
// afford an extra beat to settle.
//
// Thresholds (seconds of lead-in, keyed off the clip's target duration):
//   clip < 5s            → 2s  (snappy — don't out-stay the take)
//   5s ≤ clip ≤ 30s      → 3s  (the comfortable default)
//   clip > 30s           → 4s  (give the speaker a moment to breathe)
const SHORT_CLIP_MAX = 5;
const LONG_CLIP_MIN = 30;

const SHORT_COUNTDOWN = 2;
const DEFAULT_COUNTDOWN = 3;
const LONG_COUNTDOWN = 4;

/** The recommended countdown (seconds) for a clip of `durationSeconds`. Pure + clamped. */
export function defaultCountdownFor(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds < SHORT_CLIP_MAX) return SHORT_COUNTDOWN;

  if (durationSeconds > LONG_CLIP_MIN) return LONG_COUNTDOWN;

  return DEFAULT_COUNTDOWN;
}
