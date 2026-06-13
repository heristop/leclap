// Pure, RN-agnostic helpers shared by the expo builder components. Mirrors the web builder's
// transitionGroups + layerGeometry so the two stay in lock-step. No React/RN dependency —
// unit-tested in editorPrimitives.test.ts. Enums are imported from the core, never hardcoded.
import { XFADE_TRANSITIONS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import type { BackgroundLayer } from '../model/templateEditorModel';

export type XfadeName = (typeof XFADE_TRANSITIONS)[number];

export interface TransitionGroup {
  label: string;
  names: XfadeName[];
}

// First-match-wins bucket rules, mirrored from the web builder's transitionGroups.ts so both
// apps present the same grouping. Unmatched names fall into the leading "Fades" bucket.
const RULES: Array<{ label: string; test: (name: string) => boolean }> = [
  { label: 'Wipes', test: (n) => n.startsWith('wipe') || n.startsWith('smooth') },
  { label: 'Slides', test: (n) => n.startsWith('slide') || n.startsWith('squeeze') },
  {
    label: 'Circles',
    test: (n) => n.startsWith('circle') || n.startsWith('rect') || n.includes('close') || n.includes('open'),
  },
  { label: 'Slices', test: (n) => n.includes('slice') || n.includes('wind') },
  { label: 'Covers', test: (n) => n.startsWith('cover') },
  { label: 'Reveals', test: (n) => n.startsWith('reveal') || n.startsWith('diag') },
];

// XFADE_TRANSITIONS bucketed into ordered groups; the "Fades" catch-all comes first, then each
// rule bucket in declaration order. Empty buckets are dropped.
export function transitionGroups(): TransitionGroup[] {
  const buckets = new Map<string, XfadeName[]>([['Fades', []]]);

  for (const rule of RULES) buckets.set(rule.label, []);

  for (const name of XFADE_TRANSITIONS) {
    const rule = RULES.find((r) => r.test(name));
    const key = rule ? rule.label : 'Fades';
    buckets.get(key)?.push(name);
  }

  return [...buckets.entries()].filter(([, names]) => names.length > 0).map(([label, names]) => ({ label, names }));
}

// Title-case label for a transition chip; 'cut' renders as "Cut".
export function transitionLabel(type: string, duration: number | undefined): string {
  if (type === 'cut') return 'Cut';

  const capitalized = type.charAt(0).toUpperCase() + type.slice(1);

  return `${capitalized} · ${duration ?? 0.5}s`;
}

// --- layer geometry (percent-of-frame <-> FFmpeg iw/ih expression) ---

type Axis = 'x' | 'y' | 'w' | 'h';

const BASIS: Record<Axis, 'iw' | 'ih'> = { x: 'iw', y: 'ih', w: 'iw', h: 'ih' };

// Percentage (0..100) -> FFmpeg expression for the given axis.
export function percentToExpr(axis: Axis, percent: number): string {
  return `${BASIS[axis]}*${(percent / 100).toFixed(4)}`;
}

// Recover a 0..100 percentage from a stored value. Plain numbers read as raw percentages;
// `iw*0.25`/`ih*0.25` expressions read as their fraction x 100; anything else uses the fallback.
export function exprToPercent(value: number | string | undefined, fallback: number): number {
  if (value === undefined) return fallback;

  if (typeof value === 'number') return value;

  const match = /\*\s*(\d*\.?\d+)/.exec(value);

  if (!match) return fallback;

  const fraction = Number(match[1]);

  if (!Number.isFinite(fraction)) return fallback;

  return Math.round(fraction * 1000) / 10;
}

export const DEFAULT_EXTRA_GEOMETRY = { x: 25, y: 25, w: 50, h: 50 } as const;

// A new extra (non-base) layer: a centred half-frame translucent box.
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
