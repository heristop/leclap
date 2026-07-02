// Pure geometry for GradientMeter — shared by the arc (compile ring), the bar and the playhead
// variants. Extracted from the compile overlay so the maths is unit-tested once.

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// Radius of a stroked circle drawn inside a square `size`, so the stroke stays within bounds.
export const arcRadius = (size: number, stroke: number): number => (size - stroke) / 2;

export const circumference = (radius: number): number => 2 * Math.PI * radius;

// The stroke-dashoffset that reveals `progress` (0..1) of a dash-array equal to the circumference.
export const dashOffset = (circ: number, progress: number): number => circ * (1 - clamp01(progress));

// Filled length of a linear track (bar / playhead) for `progress` (0..1).
export const barFill = (width: number, progress: number): number => width * clamp01(progress);
