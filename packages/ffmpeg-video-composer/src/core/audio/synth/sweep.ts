// A value that is fixed or sweeps over a note (pitch, filter cutoff). Exponential sweeps move by equal
// ratios, which is how pitch and cutoff are heard; linear ones by equal steps. Pure.

import type { Curve, Pitch } from './types';

/** The value at progress `x` (0..1) through the note. */
export function sweepAt(value: Pitch, x: number): number {
  if (typeof value === 'number') return value;

  if ((value.curve ?? 'exp') === 'linear') return value.from + (value.to - value.from) * x;

  return value.from * (value.to / value.from) ** x;
}

/** A filter's cutoff spec as a sweepable value: `cutoff`, else `from` → `to`. */
export function cutoffOf(spec: { cutoff?: number; from?: number; to?: number; curve?: Curve }): Pitch {
  if (spec.cutoff !== undefined) return spec.cutoff;

  const from = spec.from ?? spec.to ?? 1000;

  return { from, to: spec.to ?? from, curve: spec.curve };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
