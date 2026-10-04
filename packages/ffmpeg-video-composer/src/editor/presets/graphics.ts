// Animated graphics → drawbox filters (docs/plans/motion-system-v2.md §4.4). Each type is a function from
// eased progress p ∈ [0, 1] to rectangles; the animator samples it once per output frame and gates each
// frame's boxes with an `enable` window, then holds the final state until `until`. Pixel effects and
// data / broadcast graphics (graphics-fx.ts, graphics-chart.ts) lower themselves through `render`/`extras`.

import type { Filter, Section } from '@/core/types';
import type { Graphic } from '../../schemas/graphics.schemas';
import { parseEasing, type EasingSpec } from '@/core/motion/easing';
import { resolvedTimes } from '@/core/timing/seconds';
import type { SugarContext } from './sugar-context';
import {
  BRAND,
  INK,
  MAX_FRAMES,
  boxes,
  windowExpr,
  withAlpha,
  type Base,
  type Frame,
  type GraphicEnv,
  type Of,
  type Rect,
  type Spec,
} from './graphics-spec';
import { FX_SPECS } from './graphics-fx';
import { CHART_SPECS } from './graphics-chart';

export type { Frame, GraphicEnv, Rect } from './graphics-spec';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

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

// Covers during the first half, uncovers during the second, travelling in `direction`.
function wipeRects(direction: 'left' | 'right' | 'up' | 'down', frame: Frame, p: number): Rect[] {
  const [lead, trail] = [Math.min(1, p * 2), Math.max(0, p * 2 - 1)];
  const horizontal = direction === 'left' || direction === 'right';
  const size = horizontal ? frame.width : frame.height;
  const span = { from: trail * size, to: lead * size };
  // left/up travel from the far edge toward the origin.
  const reversed = direction === 'left' || direction === 'up';
  const start = reversed ? size - span.to : span.from;
  const extent = span.to - span.from;

  return [horizontal ? { x: start, y: 0, w: extent, h: frame.height } : { x: 0, y: start, w: frame.width, h: extent }];
}

function panelRects(g: Extract<Graphic, { type: 'panel' }>, frame: Frame, p: number): Rect[] {
  const x = g.x ?? 0;
  const y = g.y ?? frame.height * 0.6;
  const w = g.width ?? frame.width * 0.55;
  const h = g.height ?? frame.height * 0.22;
  const table = {
    left: { x, y, w: w * p, h },
    right: { x: x + w * (1 - p), y, w: w * p, h },
    top: { x, y, w, h: h * p },
    bottom: { x, y: y + h * (1 - p), w, h: h * p },
  };

  return [table[g.from ?? 'left']];
}

function flashSpec(g: Of<'flash'>, frame: Frame, base: Base): Spec {
  const color = g.color ?? '#FFFFFF';
  const intensity = g.intensity ?? 0.85;

  return {
    ...base,
    duration: g.duration ?? 0.3,
    ease: g.ease ?? 'ease-out-cubic',
    color,
    above: g.above ?? true,
    holds: false,
    rects: () => [{ x: 0, y: 0, w: frame.width, h: frame.height }],
    colorAt: (p) => withAlpha(color, intensity * (1 - p)),
  };
}

function barsSpec(g: Of<'bars'>, frame: Frame, base: Base): Spec {
  const bar = Math.max(0, (frame.height - frame.width / (g.aspect ?? 2.39)) / 2);

  return {
    ...base,
    duration: g.duration ?? 0.6,
    color: g.color ?? '#000000',
    rects: (p) => [
      { x: 0, y: 0, w: frame.width, h: bar * p },
      { x: 0, y: frame.height - bar * p, w: frame.width, h: bar * p },
    ],
  };
}

function underlineSpec(g: Of<'underline'>, frame: Frame, base: Base): Spec {
  const x = g.x ?? frame.width * 0.08;
  const width = g.width ?? frame.width * 0.3;
  const y = g.y ?? frame.height * 0.62;
  const thickness = g.thickness ?? 6;

  return {
    ...base,
    duration: g.duration ?? 0.45,
    color: g.color ?? BRAND,
    rects: (p) => [{ ...growFrom(g.origin ?? 'left', x, width, p), y, h: thickness }],
  };
}

function frameSpec(g: Of<'frame'>, frame: Frame, base: Base): Spec {
  return {
    ...base,
    duration: g.duration ?? 0.9,
    color: g.color ?? withAlpha(INK, 0.9),
    rects: (p) => frameRects(g.inset ?? 48, g.thickness ?? 4, frame, p),
  };
}

function cornersSpec(g: Of<'corners'>, frame: Frame, base: Base): Spec {
  return {
    ...base,
    duration: g.duration ?? 0.5,
    color: g.color ?? INK,
    rects: (p) => cornerRects(g.inset ?? 56, g.length ?? 72, g.thickness ?? 5, frame, p),
  };
}

function wipeSpec(g: Of<'wipe'>, frame: Frame, base: Base): Spec {
  return {
    ...base,
    duration: g.duration ?? 0.7,
    ease: g.ease ?? 'cubic-bezier(0.65, 0, 0.35, 1)',
    color: g.color ?? BRAND,
    above: g.above ?? true,
    holds: false,
    rects: (p) => wipeRects(g.direction ?? 'left', frame, p),
  };
}

function panelSpec(g: Of<'panel'>, frame: Frame, base: Base): Spec {
  return { ...base, duration: g.duration ?? 0.6, color: g.color ?? BRAND, rects: (p) => panelRects(g, frame, p) };
}

const SPECS: { [T in Graphic['type']]: (g: Of<T>, frame: Frame, base: Base) => Spec } = {
  flash: flashSpec,
  bars: barsSpec,
  underline: underlineSpec,
  frame: frameSpec,
  corners: cornersSpec,
  wipe: wipeSpec,
  panel: panelSpec,
  ...FX_SPECS,
  ...CHART_SPECS,
};

function spec(g: Graphic, frame: Frame): Spec {
  const build = SPECS[g.type] as (g: Graphic, frame: Frame, base: Base) => Spec;

  return build(g, frame, { ease: g.ease ?? EXPO, above: g.above ?? false, holds: true });
}

/** Timing and resting footprint of one graphic, for the motion timeline (no filters are built). */
export function graphicTiming(
  g: Graphic,
  frame: Frame
): { duration: number; ease: EasingSpec; holds: boolean; bbox: Rect | null } {
  const s = spec(g, frame);
  const rects = s.holds ? s.rects(1) : [{ x: 0, y: 0, w: frame.width, h: frame.height }];
  const shown = rects.filter((r) => r.w >= 1 && r.h >= 1);

  if (shown.length === 0) return { duration: s.duration, ease: s.ease, holds: s.holds, bbox: null };

  const x = Math.min(...shown.map((r) => r.x));
  const y = Math.min(...shown.map((r) => r.y));
  const w = Math.max(...shown.map((r) => r.x + r.w)) - x;
  const h = Math.max(...shown.map((r) => r.y + r.h)) - y;

  return { duration: s.duration, ease: s.ease, holds: s.holds, bbox: { x, y, w, h } };
}

/** Seconds the graphic's animation takes (its authored duration or the type's default). */
export function graphicDuration(g: Graphic, frame: Frame): number {
  return spec(g, frame).duration;
}

const NO_SEED: GraphicEnv = { seed: 0 };

/** One graphic as filters: drawbox frame by frame then its held final state, or the type's own lowering. */
export function graphicToFilters(graphic: Graphic, frame: Frame, env: GraphicEnv = NO_SEED): Filter[] {
  const g = resolvedTimes(graphic);
  const s = spec(graphic, frame);
  const at = g.at ?? 0;

  if (s.render) return s.render({ at, until: g.until }, env);

  const curve = parseEasing(s.ease).fn;
  const frames = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(s.duration * frame.fps)));
  const animated = Array.from({ length: frames }, (_, f) => {
    const p = curve((f + 1) / frames);

    return boxes(s.rects(p), s.colorAt?.(p) ?? s.color, windowExpr(at + f / frame.fps, at + (f + 1) / frame.fps));
  }).flat();
  const end = at + frames / frame.fps;
  const held =
    s.holds && (g.until === undefined || g.until > end) ? boxes(s.rects(1), s.color, windowExpr(end, g.until)) : [];

  return [...animated, ...held, ...(s.extras?.({ at, until: g.until }, env) ?? [])];
}

function frameOf(ctx: SugarContext): Frame {
  const [width, height] = ctx.scale.split(':').map(Number);

  return { width, height, fps: ctx.fps };
}

/** The section's graphics drawn under (`above: false`) or over (`above: true`) its text. */
export function graphicsToFilters(section: Section, ctx: SugarContext, above: boolean): Filter[] {
  const graphics = (section as { graphics?: Graphic[] }).graphics;

  if (!graphics || !ctx.motion) return [];

  const frame = frameOf(ctx);

  const motion = ctx.motion;

  return graphics.flatMap((g, index) =>
    spec(g, frame).above === above ? graphicToFilters(g, frame, { seed: motion.seedFor(`graphics[${index}]`) }) : []
  );
}
