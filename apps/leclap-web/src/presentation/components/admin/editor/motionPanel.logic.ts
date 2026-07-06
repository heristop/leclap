// Pure read/write helpers for the MotionPanel: the panel edits ONE motion effect (MVP — the engine
// accepts an ordered list; list editing is a follow-up) chosen among the engine's four types.
// Crop is exposed as resolution-independent percentages, emitted as FFmpeg `iw*x`/`ih*y` expressions.
import type { MotionEffect } from '../templateEditorModel';

export type MotionKind = MotionEffect['type'];

export const MOTION_KINDS: MotionKind[] = ['kenburns', 'rotate', 'flip', 'crop'];

export const DEFAULT_INTENSITY = 1.15;
export const DEFAULT_ANGLE = 90;
export const DEFAULT_CROP_PERCENT = 80;

// The single effect this panel edits: the first entry of the motion list (none = disabled).
export function activeMotion(motion: MotionEffect[] | undefined): MotionEffect | null {
  return motion?.[0] ?? null;
}

// A fresh effect with sensible defaults for a just-picked type.
export function defaultMotion(kind: MotionKind): MotionEffect {
  if (kind === 'rotate') return { type: 'rotate', angle: DEFAULT_ANGLE };

  if (kind === 'flip') return { type: 'flip', axis: 'horizontal' };

  if (kind === 'crop') {
    return { type: 'crop', w: cropExpr('iw', DEFAULT_CROP_PERCENT), h: cropExpr('ih', DEFAULT_CROP_PERCENT) };
  }

  return { type: 'kenburns', direction: 'in', intensity: DEFAULT_INTENSITY };
}

// The motion list to store for the edited effect; disabling writes undefined so untouched sections
// stay clean (mirrors the old kenburns-only behaviour).
export function writeMotion(effect: MotionEffect | null): MotionEffect[] | undefined {
  return effect ? [effect] : undefined;
}

// A centered crop rectangle as an FFmpeg expression: percent of the input axis ('iw' or 'ih').
export function cropExpr(axis: 'iw' | 'ih', percent: number): string {
  const clamped = Math.min(100, Math.max(1, percent));

  return `${axis}*${(clamped / 100).toFixed(2)}`;
}

// Recover the percent from a stored crop dimension. Plain numbers (absolute px) and foreign
// expressions fall back to the default so the slider always has a sane position.
export function cropPercent(value: number | string | undefined): number {
  if (typeof value !== 'string') return DEFAULT_CROP_PERCENT;

  const match = /^i[wh]\*(\d*\.?\d+)$/.exec(value.trim());

  if (!match) return DEFAULT_CROP_PERCENT;

  const percent = Math.round(Number(match[1]) * 100);

  return Math.min(100, Math.max(1, percent));
}
