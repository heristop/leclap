// fx "chromatic": an RGB split hit (schemas/fx-surface.schemas.ts for the fields).
//
// A copy of the target region (a kit tap) gets rgbashift: red pushed one way along `angle`, blue the other, by
// `shift` × the target's short side (at least 1 px) at the start of each pass, settling to 0 on the eased curve;
// `jitter` wobbles the direction per frame from the element's seed. rgbashift
// takes whole pixels and no per-frame expression, so the settle is a run of filters with mid-frame `enable`
// windows, one per run of frames sharing an offset (merged where the rounded offset repeats). Outside the
// windows the tap is the untouched picture. Edges smear instead of wrapping, so a border never shows the
// opposite side. Absent under reduced motion; skipped without rgbashift (on-device allowlist).

import type { Filter } from '@/core/types';
import { parseEasing } from '@/core/motion/easing';
import { fmt } from '@/core/motion/hermite';
import { mergeRuns, sampleSteps } from './graphics-spec';
import type { FxContext, FxEffect, FxLayer } from './fx-kit';
import { fromWindow, withAlpha } from './fx-light-kit';

/** Frames [from, to) in section seconds where blue sits (dx, dy) px from the picture and red at (−dx, −dy). */
export interface ChromaticRun {
  from: number;
  to: number;
  dx: number;
  dy: number;
}

/** Widest per-frame swing of the split direction at jitter 1, degrees. */
const JITTER = 60;

// Context defaults, drawn in a fixed order: shift, then angle (the jitter draws come after, per frame).
function lookOf(fx: FxContext<'chromatic'>): { pixels: number; radians: number } {
  const g = fx.graphic;
  const shift = g.shift ?? 0.008 + fx.random() * 0.006;
  const angle = g.angle ?? (fx.random() * 2 - 1) * 15;
  const short = Math.min(fx.target.w, fx.target.h);

  const amount = g.intensity ?? 1;

  // A hit always shows: at least one pixel on a small target, unless intensity switches it off.
  return { pixels: amount > 0 ? Math.max(1, shift * short * amount) : 0, radians: (angle * Math.PI) / 180 };
}

/** One pass's offsets, frame by frame: the full split on the first frame, eased to 0 by the last. */
function passOffsets(fx: FxContext<'chromatic'>, start: number, pixels: number, radians: number): ChromaticRun[] {
  const curve = parseEasing(fx.ease).fn;
  const frames = sampleSteps(start, fx.duration, fx.frame.fps);

  const jitter = ((fx.graphic.jitter ?? 0) * JITTER * Math.PI) / 180;

  return frames.map((frame, i) => {
    const amount = pixels * (1 - curve(i / frames.length));
    const angle = jitter > 0 ? radians + (fx.random() * 2 - 1) * jitter : radians;

    return {
      from: frame.from,
      to: Math.min(frame.to, fx.end),
      dx: Math.round(amount * Math.cos(angle)),
      dy: Math.round(amount * Math.sin(angle)),
    };
  });
}

/** The split over every pass, as runs of frames sharing an offset, zero offsets dropped (the preview reads it). */
export function chromaticRuns(fx: FxContext<'chromatic'>): ChromaticRun[] {
  const { pixels, radians } = lookOf(fx);
  const offsets = Array.from({ length: fx.passes }, (_, k) => fx.at + k * fx.every)
    .filter((start) => start < fx.end)
    .flatMap((start) => passOffsets(fx, start, pixels, radians))
    .filter((offset) => offset.from < offset.to);

  return mergeRuns(offsets, (offset) => `${offset.dx},${offset.dy}`).filter((run) => run.dx !== 0 || run.dy !== 0);
}

/** One rgbashift per run, red pushed by −offset and blue by +offset. */
export function chromaticSteps(fx: FxContext<'chromatic'>): Filter[] {
  const half = 0.5 / fx.frame.fps;

  return chromaticRuns(fx).map((run) => {
    // Mid-frame bounds: a frame's timestamp never sits on the rounded edge of a window.
    const window = `between(t,${fmt(run.from - half)},${fmt(run.to - half)})`;
    const shifts = `rh=${-run.dx}:rv=${-run.dy}:bh=${run.dx}:bv=${run.dy}`;

    return { type: 'rgbashift', value: `${shifts}:edge=smear:enable='${window}'` };
  });
}

function lower(fx: FxContext<'chromatic'>): FxLayer[] | null {
  if (fx.reduced) return [];

  if (!fx.has('rgbashift')) return null;

  const p = fx.prefix;
  const steps = chromaticSteps(fx);

  if (steps.length === 0) return [];

  return [
    {
      chains: [{ inputs: [`${p}tap`], filters: [fromWindow(fx), ...steps, ...withAlpha(1)], outputs: [`${p}ca`] }],
      label: `${p}ca`,
      x: '0',
      y: '0',
      taps: [`${p}tap`],
    },
  ];
}

export const CHROMATIC: FxEffect<'chromatic'> = { lower };
