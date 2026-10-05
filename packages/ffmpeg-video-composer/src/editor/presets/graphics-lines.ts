// The stroke graphics as the graphics table (graphics.ts) sees them: underline, frame and corners. Without
// any v2 field they are the legacy drawbox traces, unchanged. With one (schemas/graphics-stroke.schemas.ts)
// their spec hands the element to the compile path's v2 lowering (stroke-graphics.ts, reached through
// SugarContext.masks.strokes so it stays out of the browser's eager load); where that lowering is absent
// (validation, timelines) the legacy rectangles stand in. The v2 defaults live here so the timeline and
// the lowering agree on the duration.

import { STROKE_V2_FIELDS } from '../../schemas/graphics-stroke.schemas';
import { BRAND, INK, withAlpha, type Base, type Frame, type Of, type Rect, type Spec } from './graphics-spec';

export type StrokeType = keyof typeof STROKE_V2_FIELDS;
export type StrokeGraphic = Of<StrokeType>;

/** v2 defaults per type: entrance seconds, ease, exit. */
export const STROKE_V2_DEFAULTS = {
  frame: { duration: 0.6, ease: 'cubic-bezier(0.16, 1, 0.3, 1)', exit: 'fade' },
  corners: { duration: 0.5, ease: 'spring(420, 30)', exit: 'expand' },
  underline: { duration: 0.5, ease: 'cubic-bezier(0.16, 1, 0.3, 1)', exit: 'fade' },
} as const;

/** True when the graphic sets any v2 field (it then lowers through the v2 path). */
export function isStrokeV2(g: { type: string }): boolean {
  if (!Object.hasOwn(STROKE_V2_FIELDS, g.type)) return false;

  return STROKE_V2_FIELDS[g.type as StrokeType].some((field) => (g as Record<string, unknown>)[field] !== undefined);
}

function growFrom(origin: 'left' | 'center' | 'right', x: number, width: number, p: number): { x: number; w: number } {
  const w = width * p;

  if (origin === 'center') return { x: x + (width - w) / 2, w };

  return origin === 'right' ? { x: x + width - w, w } : { x, w };
}

// Progress of the k-th quarter of a clockwise trace.
function quarter(p: number, k: number): number {
  return Math.max(0, Math.min(1, p * 4 - k));
}

// Clockwise trace: top (left→right), right (top→bottom), bottom (right→left), left (bottom→top).
function frameRects(inset: number, t: number, frame: Frame, p: number): Rect[] {
  const [left, top] = [inset, inset];
  const [w, h] = [frame.width - 2 * inset, frame.height - 2 * inset];

  return [
    { x: left, y: top, w: w * quarter(p, 0), h: t },
    { x: left + w - t, y: top, w: t, h: h * quarter(p, 1) },
    { x: left + w - w * quarter(p, 2), y: top + h - t, w: w * quarter(p, 2), h: t },
    { x: left, y: top + h - h * quarter(p, 3), w: t, h: h * quarter(p, 3) },
  ];
}

function cornerRects(inset: number, length: number, t: number, frame: Frame, p: number): Rect[] {
  const l = length * p;
  const [r, b] = [frame.width - inset, frame.height - inset];

  return [
    { x: inset, y: inset, w: l, h: t },
    { x: inset, y: inset, w: t, h: l },
    { x: r - l, y: inset, w: l, h: t },
    { x: r - t, y: inset, w: t, h: l },
    { x: inset, y: b - t, w: l, h: t },
    { x: inset, y: b - l, w: t, h: l },
    { x: r - l, y: b - t, w: l, h: t },
    { x: r - t, y: b - l, w: t, h: l },
  ];
}

// A v2 graphic keeps its legacy rectangles (the timeline footprint, and the stand-in where the v2 lowering
// is absent) and renders through masks.strokes when the compile path provides it.
function v2(g: StrokeGraphic, legacy: Spec, above: boolean): Spec {
  if (!isStrokeV2(g)) return legacy;

  const defaults = STROKE_V2_DEFAULTS[g.type];

  return {
    ...legacy,
    above,
    duration: g.duration ?? defaults.duration,
    ease: g.ease ?? defaults.ease,
    render: (window, env) =>
      env.site?.ctx.masks?.strokes?.({ graphic: g, ...window, seed: env.seed, ...env.site }) ?? null,
  };
}

export function underlineSpec(g: Of<'underline'>, frame: Frame, base: Base): Spec {
  const x = g.x ?? frame.width * 0.08;
  const width = g.width ?? frame.width * 0.3;
  const y = g.y ?? frame.height * 0.62;
  const thickness = g.thickness ?? 6;
  const legacy: Spec = {
    ...base,
    duration: g.duration ?? 0.45,
    color: g.color ?? BRAND,
    rects: (p) => [{ ...growFrom(g.origin ?? 'left', x, width, p), y, h: thickness }],
  };

  // A v2 underline draws above text by default: a CTA card or plate drawn with the text never hides it.
  return v2(g, legacy, g.above ?? true);
}

export function frameSpec(g: Of<'frame'>, frame: Frame, base: Base): Spec {
  const legacy: Spec = {
    ...base,
    duration: g.duration ?? 0.9,
    color: g.color ?? withAlpha(INK, 0.9),
    rects: (p) => frameRects(g.inset ?? 48, g.thickness ?? 4, frame, p),
  };

  return v2(g, legacy, base.above);
}

export function cornersSpec(g: Of<'corners'>, frame: Frame, base: Base): Spec {
  const legacy: Spec = {
    ...base,
    duration: g.duration ?? 0.5,
    color: g.color ?? INK,
    rects: (p) => cornerRects(g.inset ?? 56, g.length ?? 72, g.thickness ?? 5, frame, p),
  };

  return v2(g, legacy, base.above);
}
