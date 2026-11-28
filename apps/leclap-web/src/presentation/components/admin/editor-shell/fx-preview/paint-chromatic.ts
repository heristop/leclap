// The chromatic hit on the edit canvas. The canvas cannot read the picture, so it draws the split's
// fringes instead: the target outline in red at −offset and in blue at +offset, as thick as the split,
// from the engine's own runs (fx-chromatic.ts), so a tweak moves the cue the way it moves the render.
import { chromaticRuns, type ChromaticRun } from 'ffmpeg-video-composer/src/editor/presets/fx-chromatic.ts';
import type { FxContext } from 'ffmpeg-video-composer/src/editor/presets/fx-kit.ts';
import type { FxPainter } from './painter';

/** The split at section time `t`, or null between hits. */
export function splitAt(runs: ChromaticRun[], t: number): { dx: number; dy: number } | null {
  const run = runs.find((r) => t >= r.from && t < r.to);

  return run ? { dx: run.dx, dy: run.dy } : null;
}

export function paintChromatic(fx: FxContext<'chromatic'>): NonNullable<FxPainter['paint']> {
  const runs = chromaticRuns(fx);
  const { x, y, w, h } = fx.target;

  return (ctx, t) => {
    const split = splitAt(runs, t);

    if (!split) return;

    const width = Math.max(1, Math.hypot(split.dx, split.dy));

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = width;
    ctx.strokeStyle = '#ff2030';
    ctx.strokeRect(x - split.dx, y - split.dy, w, h);
    ctx.strokeStyle = '#2050ff';
    ctx.strokeRect(x + split.dx, y + split.dy, w, h);
    ctx.restore();
  };
}
