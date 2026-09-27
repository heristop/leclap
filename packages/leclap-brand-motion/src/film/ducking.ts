// How loud the score sits at a given second: `level` between narration lines, ducked by `duck` while
// the narrator speaks — dipping ~250 ms before a line and recovering ~350 ms after it. Pure, so the
// composition's <Soundtrack> (studio preview) and the render's soundtrack mixer (audio/mix-soundtrack.ts)
// share one curve.

export interface VoiceLineTiming {
  start: number;
  duration: number;
}

export const SCORE_LEVEL = 0.62;
export const DUCK_DEPTH = 0.62;

const ramp = (x: number, from: number, to: number): number => Math.min(1, Math.max(0, (x - from) / (to - from)));

export const scoreVolumeAt = (
  seconds: number,
  lines: readonly VoiceLineTiming[],
  level = SCORE_LEVEL,
  duck = DUCK_DEPTH
): number => {
  const ducked = lines.reduce((max, line) => {
    const attack = ramp(seconds, line.start - 0.25, line.start);
    const release = 1 - ramp(seconds, line.start + line.duration, line.start + line.duration + 0.35);

    return Math.max(max, Math.min(attack, release));
  }, 0);

  return level * (1 - duck * ducked);
};
