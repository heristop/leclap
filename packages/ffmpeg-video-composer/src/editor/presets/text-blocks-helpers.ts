import type { Filter } from '@/core/types';
import {
  type RevealInput,
  type TextEffect,
  type Translation,
  applyReveal,
  applyTextEffect,
  hasText,
  revealEnableExpr,
  staggered,
} from './text';

export function round(value: number): number {
  return Math.round(value);
}

export function parseScale(scale: string): { w: number; h: number } {
  const [w, h] = scale.split(':').map((part) => parseInt(part, 10));

  return { w: Number.isFinite(w) ? w : 1280, h: Number.isFinite(h) ? h : 720 };
}

export type LineSpec = {
  text: Translation | undefined;
  x: string;
  y: number;
  font: string;
  size: number;
  color: string;
};

// Pushes one styled, optionally-revealed drawtext line when it has text; returns the next stagger index.
export function pushLine(
  filters: Filter[],
  spec: LineSpec,
  reveal: RevealInput,
  index: number,
  effect?: TextEffect
): number {
  if (!hasText(spec.text)) {
    return index;
  }

  const values: Record<string, unknown> = {
    text: { ...spec.text },
    x: spec.x,
    y: spec.y,
    fontfile: spec.font,
    fontsize: spec.size,
    fontcolor: spec.color,
  };

  applyTextEffect(values, effect);
  applyReveal(values, staggered(reveal, index), { x: spec.x, y: spec.y });
  filters.push({ type: 'drawtext', values: values as Filter['values'] });

  return index + 1;
}

// A solid accent bar (drawbox), or nothing when no accent colour is set. `reveal` is the (already
// staggered) reveal of the text line the bar decorates: drawbox has no alpha expression, so the bar
// follows the text's entrance via a timeline gate (`enable='gte(t,delay)'`) — it pops in when the
// text starts entering instead of sitting alone on screen before it.
export function accentBar(
  accent: string | undefined,
  geom: { x: string | number; y: number; w: number; h: number },
  reveal?: RevealInput
): Filter[] {
  if (!accent) {
    return [];
  }

  const enable = revealEnableExpr(reveal);
  const gate = enable === undefined ? {} : { enable };

  return [
    { type: 'drawbox', values: { x: geom.x, y: geom.y, w: geom.w, h: geom.h, c: `${accent}@1`, t: 'fill', ...gate } },
  ];
}
