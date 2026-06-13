// Pure helpers translating between the LayersEditor's friendly "percent of frame"
// inputs and the FFmpeg expressions a BackgroundLayer's x/y/w/h carry (iw/ih-relative,
// e.g. `iw*0.25`). The base layer is full-bleed and never gets geometry.
import type { BackgroundLayer } from '../templateEditorModel';

type Axis = 'x' | 'y' | 'w' | 'h';

// The frame dimension each axis is a percentage of: x/w → width (iw), y/h → height (ih).
const BASIS: Record<Axis, 'iw' | 'ih'> = { x: 'iw', y: 'ih', w: 'iw', h: 'ih' };

// Percentage (0..100) → FFmpeg expression for the given axis.
export function percentToExpr(axis: Axis, percent: number): string {
  return `${BASIS[axis]}*${(percent / 100).toFixed(4)}`;
}

// Recover a 0..100 percentage from a stored value. Plain numbers are read as raw
// percentages; `iw*0.25`/`ih*0.25` expressions are read as their fraction × 100;
// anything else falls back to the supplied default.
export function exprToPercent(value: number | string | undefined, fallback: number): number {
  if (value === undefined) return fallback;

  if (typeof value === 'number') return value;

  const match = /\*\s*(\d*\.?\d+)/.exec(value);

  if (!match) return fallback;

  const fraction = Number(match[1]);

  if (!Number.isFinite(fraction)) return fallback;

  return Math.round(fraction * 1000) / 10;
}

// The default geometry (in percent) of a freshly added extra layer: a centred half-frame box.
export const DEFAULT_EXTRA_GEOMETRY = { x: 25, y: 25, w: 50, h: 50 } as const;

// A new extra (non-base) layer with sensible defaults.
export function newExtraLayer(): BackgroundLayer {
  return {
    color: '#000000',
    opacity: 0.5,
    x: percentToExpr('x', DEFAULT_EXTRA_GEOMETRY.x),
    y: percentToExpr('y', DEFAULT_EXTRA_GEOMETRY.y),
    w: percentToExpr('w', DEFAULT_EXTRA_GEOMETRY.w),
    h: percentToExpr('h', DEFAULT_EXTRA_GEOMETRY.h),
  };
}

// A new base (first) layer: a full-bleed solid colour.
export function newBaseLayer(color: string): BackgroundLayer {
  return { color, opacity: 1 };
}
