// Whip transitions: the motion blur of a push at speed. The push's curve is differentiated at compile
// time, frame by frame; where it moves fast, a gaussian blur stretched along the travel axis is enabled
// for that frame, with a radius proportional to the speed. Frames sharing a radius share one filter.
// gblur geometry is fixed per instance, so the radius steps per enable window: frame-exact and
// deterministic, like the animated graphics.

import { parseEasing, type EasingSpec } from './easing';
import { fmt } from './hermite';

/** Default whip curve: a sharper in-out than the push default, so the peak speed is short and high. */
export const WHIP_EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
/** Peak blur radius as a fraction of the travel axis (≈ 38 px on a 1280 px frame). */
const PEAK_BLUR = 0.03;
/** Below this share of the peak speed the frame stays sharp. */
const BLUR_THRESHOLD = 0.2;
/** Blur across the travel axis: a hair, so the smear reads as directional. */
const CROSS_SIGMA = 0.5;

export interface WhipSpec {
  ease: EasingSpec;
  duration: number;
  fps: number;
  width: number;
  height: number;
  type: string;
}

interface Run {
  from: number;
  to: number;
  sigma: number;
}

// Speed of the curve at the middle of each output frame, as a share of the fastest frame.
function frameSpeeds(ease: EasingSpec, frames: number): number[] {
  const fn = parseEasing(ease).fn;
  const h = 0.5 / frames;
  const speeds = Array.from({ length: frames }, (_, f) => {
    const mid = (f + 0.5) / frames;

    return Math.abs(fn(Math.min(1, mid + h)) - fn(Math.max(0, mid - h)));
  });
  const peak = Math.max(...speeds);

  return speeds.map((speed) => (peak > 0 ? speed / peak : 0));
}

function blurRuns(spec: WhipSpec, axis: number): Run[] {
  const frames = Math.max(1, Math.round(spec.duration * spec.fps));
  const runs: Run[] = [];

  for (const [f, speed] of frameSpeeds(spec.ease, frames).entries()) {
    const sigma = speed < BLUR_THRESHOLD ? 0 : Math.round(axis * PEAK_BLUR * speed);
    const last = runs.at(-1);
    const from = f / spec.fps;

    if (last?.sigma === sigma) {
      last.to = (f + 1) / spec.fps;
      continue;
    }

    runs.push({ from, to: (f + 1) / spec.fps, sigma });
  }

  return runs.filter((run) => run.sigma >= 1);
}

/** The blur chain applied over a whip's composed frames (timestamps start at 0), or a passthrough. */
export function whipBlur(spec: WhipSpec): string {
  const vertical = spec.type === 'whip-up' || spec.type === 'whip-down';
  const runs = blurRuns(spec, vertical ? spec.height : spec.width);

  if (runs.length === 0) return 'null';

  return runs
    .map((run) => {
      const [h, v] = vertical ? [CROSS_SIGMA, run.sigma] : [run.sigma, CROSS_SIGMA];

      return `gblur=sigma=${fmt(h)}:sigmaV=${fmt(v)}:enable='gte(t,${fmt(run.from)})*lt(t,${fmt(run.to)})'`;
    })
    .join(',');
}
