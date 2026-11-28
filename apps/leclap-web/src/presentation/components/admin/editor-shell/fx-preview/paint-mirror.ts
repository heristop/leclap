// The mirror on the edit canvas. The canvas cannot flip the picture, so it marks where the reflection lands:
// a light veil over each reflected area and a dashed line on each seam, from the engine's own plan
// (fx-mirror.ts), so a tweak moves the cue the way it moves the render.
import { mirrorPlan, type Reflection } from 'ffmpeg-video-composer/src/editor/presets/fx-mirror.ts';
import type { FxContext } from 'ffmpeg-video-composer/src/editor/presets/fx-kit.ts';
import { inWindow } from './fx-time';
import type { Box, FxPainter } from './painter';

/** The areas the reflections cover, in output px, in plan order. */
export function reflectedBoxes(target: Box, plan: Reflection[]): Box[] {
  return plan.map((step) =>
    step.axis === 'x'
      ? { x: target.x + step.place, y: target.y, w: step.reach, h: target.h }
      : { x: target.x, y: target.y + step.place, w: target.w, h: step.reach }
  );
}

export function paintMirror(fx: FxContext<'mirror'>): NonNullable<FxPainter['paint']> {
  const plan = mirrorPlan(fx);
  const boxes = reflectedBoxes(fx.target, plan);
  const { x, y, w, h } = fx.target;

  return (ctx, t) => {
    if (!inWindow(fx, t)) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';

    for (const box of boxes) ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();

    for (const step of plan) {
      if (step.axis === 'x') {
        ctx.moveTo(x + step.seam, y);
        ctx.lineTo(x + step.seam, y + h);
        continue;
      }
      ctx.moveTo(x, y + step.seam);
      ctx.lineTo(x + w, y + step.seam);
    }
    ctx.stroke();
    ctx.restore();
  };
}
