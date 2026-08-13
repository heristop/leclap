// Pure geometry for GradientMeter — shared by the arc (render ring), the bar and the playhead
// variants. Extracted so the maths is unit-tested once and the meters stay one family.

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// Radius of a stroked circle drawn inside a square `size`, so the stroke stays within bounds.
export const arcRadius = (size: number, stroke: number): number => (size - stroke) / 2;

export const circumference = (radius: number): number => 2 * Math.PI * radius;

// The stroke-dashoffset that reveals `progress` (0..1) of a dash-array equal to the circumference.
export const dashOffset = (circ: number, progress: number): number => circ * (1 - clamp01(progress));

// Filled length of a linear track (bar / playhead) as a CSS percentage, for `progress` (0..1).
export const barPct = (progress: number): number => clamp01(progress) * 100;

// A `value / total` progress in 0..1, guarding a zero/negative total — the shape both the editor's
// ready meter (done/total scenes) and the timeline scrubber (position/duration) feed to GradientMeter.
export const ratio01 = (value: number, total: number): number => {
  if (total <= 0) return 0;

  return clamp01(value / total);
};

// Whether the live head-light should ride the fill's leading edge: opt-in (`live`), and suppressed
// once the meter is in its success state or fully filled, so nothing keeps moving on a settled or
// complete bar (the render bar keeps its still success-green swap on completion).
export const showLiveHead = (live: boolean, success: boolean, progress: number): boolean =>
  live && !success && clamp01(progress) < 1;
