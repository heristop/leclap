// When and where a drawn layer rests: its `alpha`/`enable` expressions sampled across the section,
// its position read where it is most opaque. Split out of text-boxes.ts to keep it under the
// max-lines budget.
import DefaultConfig from '@/core/default.config';
import { evaluateExpr, type ExprVariables } from './drawtext-expr';

// Every 0.05s, capped so a long section still costs a bounded number of evaluations — enough to find
// where a reveal settles and when a staggered line or a gated bar is on screen.
const SAMPLE_STEP_SEC = 0.05;
const MAX_SAMPLES = 400;

export interface Track {
  x: number;
  y: number;
  from: number;
  to: number;
  at: number;
}

function sampleTimes(duration: number): number[] {
  if (duration <= 0) {
    return [0];
  }

  const count = Math.min(MAX_SAMPLES, Math.ceil(duration / SAMPLE_STEP_SEC)) + 1;

  return Array.from({ length: count }, (_, i) => (duration * i) / (count - 1));
}

// A value an expression could not evaluate is treated as "shown": missing a finding beats inventing one.
function gate(expr: unknown, env: ExprVariables): number {
  return expr === undefined ? 1 : (evaluateExpr(expr, env) ?? 1);
}

// Where a layer rests and when it is on screen. `alpha`/`enable` are sampled across the section;
// the resting position is read where the layer is at its most opaque — after a reveal settles, before
// an exit leaves. Null when it is never shown, or its position cannot be evaluated.
export function track(values: Record<string, unknown>, vars: ExprVariables, duration: number): Track | null {
  const visible = sampleTimes(duration)
    .map((t) => {
      const env = { ...vars, t, n: t * DefaultConfig.FPS };

      return { t, alpha: gate(values.enable, env) === 0 ? 0 : gate(values.alpha, env) };
    })
    .filter((sample) => sample.alpha > 0);

  if (visible.length === 0) {
    return null;
  }

  const peak = Math.max(...visible.map((sample) => sample.alpha));
  const settled = visible.filter((sample) => sample.alpha >= peak - 0.01);
  const at = settled.at(Math.floor(settled.length / 2))?.t ?? 0;
  const env = { ...vars, t: at, n: at * DefaultConfig.FPS };
  const x = evaluateExpr(values.x ?? 0, env);
  const y = evaluateExpr(values.y ?? 0, env);

  if (x === null || y === null) {
    return null;
  }

  return { x, y, from: visible[0].t, to: visible.at(-1)?.t ?? visible[0].t, at };
}

// Floating-point: `w-(tw+100)-80` and `w-tw-80-100` can differ in the last bit.
function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

// The side a preset pins: `x` that ignores text_w is pinned left, `x` that moves with it one-for-one is
// pinned right, anything else (centred text) is pinned to neither.
export function anchoredSide(
  values: Record<string, unknown>,
  vars: ExprVariables,
  textWidth: number,
  at: number
): 'left' | 'right' | undefined {
  const env: ExprVariables = { ...vars, t: at, n: at * DefaultConfig.FPS };
  const narrow = evaluateExpr(values.x, env);
  const wide = evaluateExpr(values.x, { ...env, text_w: textWidth + 100 });

  if (narrow === null || wide === null) {
    return undefined;
  }

  if (near(wide, narrow)) {
    return 'left';
  }

  return near(wide, narrow - 100) ? 'right' : undefined;
}
