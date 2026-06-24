import type { Filter, GlobalTextOverlay } from '@/core/types';
import {
  type RevealInput,
  type Translation,
  applyReveal,
  hasText,
  resolveFontFile,
  staggered,
} from './text';

const DEFAULT_FADE_COLOR = '#000000';
const BAND_COLOR = '#0a0f14';
const DEFAULT_BAND_OPACITY = 0.6;

function round(value: number): number {
  return Math.round(value);
}

function parseScale(scale: string): { w: number; h: number } {
  const [w, h] = scale.split(':').map((part) => parseInt(part, 10));

  return { w: Number.isFinite(w) ? w : 1280, h: Number.isFinite(h) ? h : 720 };
}

type LineSpec = {
  text: Translation | undefined;
  x: string;
  y: number;
  font: string;
  size: number;
  color: string;
};

// Pushes one styled, optionally-revealed drawtext line when it has text; returns the next stagger index.
function pushLine(filters: Filter[], spec: LineSpec, reveal: RevealInput, index: number): number {
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

  applyReveal(values, staggered(reveal, index), { x: spec.x, y: spec.y });
  filters.push({ type: 'drawtext', values: values as Filter['values'] });

  return index + 1;
}

// A solid accent bar (drawbox), or nothing when no accent colour is set.
function accentBar(accent: string | undefined, geom: { x: string | number; y: number; w: number; h: number }): Filter[] {
  if (!accent) {
    return [];
  }

  return [{ type: 'drawbox', values: { x: geom.x, y: geom.y, w: geom.w, h: geom.h, c: `${accent}@1`, t: 'fill' } }];
}

// ---------------------------------------------------------------------------
// titleCard — a kicker / headline / subtitle card on a color_background section
// ---------------------------------------------------------------------------
//
// Collapses the ~80-line intro/outro boilerplate (full-frame fill + eyebrow + headline + accent bar +
// subtitle + staggered alpha/kinetic expressions + fades) into one structured block. Lowers to the
// same drawtext/drawbox/fade filters authors used to write by hand.

export type TitleCard = {
  kicker?: Translation;
  headline?: Translation;
  subtitle?: Translation;
  /** Accent colour: draws an underline bar and tints the kicker. Omit for no bar / white kicker. */
  accent?: string;
  align?: 'left' | 'center';
  /** Fade colour; defaults to the section background. */
  background?: string;
  /** Entrance for the lines, staggered top-to-bottom (default "rise"). */
  reveal?: RevealInput;
  /** Auto fade-in / fade-out over the card (both default on). */
  fade?: { in?: boolean; out?: boolean };
};

export type TitleCardContext = {
  /** Output scale as 'W:H'. */
  scale: string;
  /** The color_background's base colour, used as the fade colour fallback. */
  backgroundColor?: string;
};

function titleCardFades(fade: TitleCard['fade'], color: string): Filter[] {
  const filters: Filter[] = [];

  if (fade?.in !== false) {
    filters.push({ type: 'fadein', values: { color } });
  }

  if (fade?.out !== false) {
    filters.push({ type: 'fadeout', values: { color } });
  }

  return filters;
}

/**
 * Lowers a TitleCard into an ordered drawtext/drawbox/fade filter list. Positions and sizes are
 * derived from the output scale so one card renders correctly in portrait, square and landscape.
 * Returns [] when the card has no text at all.
 */
export function titleCardToFilters(titleCard: TitleCard | undefined, ctx: TitleCardContext): Filter[] {
  if (!titleCard || (!hasText(titleCard.kicker) && !hasText(titleCard.headline) && !hasText(titleCard.subtitle))) {
    return [];
  }

  const { w, h } = parseScale(ctx.scale);
  const align = titleCard.align ?? 'left';
  const margin = round(w * 0.06);
  const reveal = titleCard.reveal ?? 'rise';
  const accent = titleCard.accent;
  const x = align === 'center' ? '(w-text_w)/2' : String(margin);

  const filters: Filter[] = [];
  let index = 0;

  index = pushLine(filters, { text: titleCard.kicker, x, y: round(h * 0.4), font: 'Oswald.ttf', size: round(h * 0.026), color: accent ?? '#ffffff' }, reveal, index);
  index = pushLine(filters, { text: titleCard.headline, x, y: round(h * 0.452), font: 'Anton.ttf', size: round(h * 0.085), color: '#ffffff' }, reveal, index);

  const barW = round(w * 0.13);
  const barX = align === 'center' ? `(w-${barW})/2` : margin;
  filters.push(...accentBar(accent, { x: barX, y: round(h * 0.585), w: barW, h: Math.max(4, round(h * 0.006)) }));

  pushLine(filters, { text: titleCard.subtitle, x, y: round(h * 0.63), font: 'Oswald.ttf', size: round(h * 0.03), color: '#cfd3de' }, reveal, index);

  const fadeColor = titleCard.background ?? ctx.backgroundColor ?? DEFAULT_FADE_COLOR;
  filters.push(...titleCardFades(titleCard.fade, fadeColor));

  return filters;
}

// ---------------------------------------------------------------------------
// lowerThird — a title / subtitle band over a project_video clip
// ---------------------------------------------------------------------------
//
// Collapses the inputs[]/maps[]/@name ceremony a lower-third used to need into one structured block:
// a translucent band, an accent bar, a title + subtitle, and an optional right-aligned badge (a price,
// a step number). `accent` and `boxOpacity` are separate so the compiler builds the `#rrggbb@opacity`
// tokens — authors never write `{{ var }}@alpha` by hand.

export type LowerThird = {
  title?: Translation;
  subtitle?: Translation;
  /** Accent colour: draws an accent bar and the badge background. */
  accent?: string;
  /** Opacity of the legibility band behind the text, 0..1 (default 0.6; 0 = no band). */
  boxOpacity?: number;
  /** Vertical anchor of the band (default "bottom"). */
  position?: 'bottom' | 'top';
  /** Optional right-aligned pill (price, step, badge). */
  badge?: Translation;
  /** Entrance for the lines (default "rise"). */
  reveal?: RevealInput;
};

export type LowerThirdContext = {
  /** Output scale as 'W:H'. */
  scale: string;
};

function band(boxOpacity: number | undefined, y: number, h: number): Filter[] {
  const opacity = boxOpacity ?? DEFAULT_BAND_OPACITY;

  if (opacity <= 0) {
    return [];
  }

  return [{ type: 'drawbox', values: { x: 0, y, w: 'iw', h, c: `${BAND_COLOR}@${opacity}`, t: 'fill' } }];
}

function badgePill(text: Translation | undefined, accent: string | undefined, geom: { x: string; y: number; size: number; border: number }, reveal: RevealInput): Filter[] {
  if (!hasText(text)) {
    return [];
  }

  const values: Record<string, unknown> = {
    text: { ...text },
    x: geom.x,
    y: geom.y,
    fontfile: 'Anton.ttf',
    fontsize: geom.size,
    fontcolor: accent ? BAND_COLOR : '#ffffff',
    box: 1,
    boxcolor: `${accent ?? '#7C83FF'}@1`,
    boxborderw: geom.border,
  };

  // The badge only fades in (a kinetic x would fight the right-alignment expression).
  applyReveal(values, reveal, { x: geom.x, y: geom.y });

  return [{ type: 'drawtext', values: values as Filter['values'] }];
}

/**
 * Lowers a LowerThird into a drawbox/drawtext filter list composited over the section clip. Positions
 * and sizes are derived from the output scale, anchored to the chosen edge. Returns [] when empty.
 */
export function lowerThirdToFilters(lowerThird: LowerThird | undefined, ctx: LowerThirdContext): Filter[] {
  if (!lowerThird || (!hasText(lowerThird.title) && !hasText(lowerThird.subtitle) && !hasText(lowerThird.badge))) {
    return [];
  }

  const { w, h } = parseScale(ctx.scale);
  const margin = round(w * 0.06);
  const reveal = lowerThird.reveal ?? 'rise';
  const accent = lowerThird.accent;
  const bandH = round(h * 0.2);
  const bandY = lowerThird.position === 'top' ? 0 : h - bandH;
  const x = String(margin);

  const filters: Filter[] = [];
  filters.push(...band(lowerThird.boxOpacity, bandY, bandH));
  filters.push(...accentBar(accent, { x: margin, y: bandY + round(h * 0.04), w: round(w * 0.1), h: Math.max(4, round(h * 0.006)) }));

  let index = 0;
  index = pushLine(filters, { text: lowerThird.title, x, y: bandY + round(h * 0.055), font: 'Anton.ttf', size: round(h * 0.05), color: '#ffffff' }, reveal, index);
  index = pushLine(filters, { text: lowerThird.subtitle, x, y: bandY + round(h * 0.125), font: 'Oswald.ttf', size: round(h * 0.028), color: '#c9d0f5' }, reveal, index);

  const badgeGeom = { x: `w-text_w-${margin}`, y: bandY + round(h * 0.055), size: round(h * 0.04), border: Math.max(8, round(h * 0.014)) };
  filters.push(...badgePill(lowerThird.badge, accent, badgeGeom, staggered('fade', index)));

  return filters;
}

// ---------------------------------------------------------------------------
// global text overlay — a whole-video watermark composited onto every section
// ---------------------------------------------------------------------------

export type GlobalTextContext = {
  /** Output scale as 'W:H'. */
  scale: string;
};

// Anchor presets → drawtext x/y expressions, given the frame margins.
function anchor(position: string, mx: number, my: number): { x: string; y: string } {
  const anchors: Record<string, { x: string; y: string }> = {
    'top-left': { x: String(mx), y: String(my) },
    'top-right': { x: `w-text_w-${mx}`, y: String(my) },
    'bottom-left': { x: String(mx), y: `h-text_h-${my}` },
    'bottom-right': { x: `w-text_w-${mx}`, y: `h-text_h-${my}` },
    top: { x: '(w-text_w)/2', y: String(my) },
    bottom: { x: '(w-text_w)/2', y: `h-text_h-${my}` },
    center: { x: '(w-text_w)/2', y: '(h-text_h)/2' },
  };

  return anchors[position] ?? anchors['top-right'];
}

/**
 * Lowers a global text overlay into a single anchored drawtext filter. A reveal animates the entrance;
 * otherwise a static opacity (< 1) sets a constant alpha. Returns [] when the overlay has no text.
 */
export function globalTextOverlayToFilters(overlay: GlobalTextOverlay, ctx: GlobalTextContext): Filter[] {
  if (!hasText(overlay.text)) {
    return [];
  }

  const { w, h } = parseScale(ctx.scale);
  const pos = anchor(overlay.position ?? 'top-right', round(w * 0.05), round(h * 0.05));

  const values: Record<string, unknown> = {
    text: { ...overlay.text },
    x: pos.x,
    y: pos.y,
    fontfile: resolveFontFile(overlay.font, 'Oswald.ttf'),
    fontsize: overlay.size ?? round(h * 0.03),
    fontcolor: overlay.color ?? '#ffffff',
  };

  if (overlay.reveal) {
    applyReveal(values, overlay.reveal, pos);
  }

  if (!overlay.reveal && overlay.opacity !== undefined && overlay.opacity < 1) {
    values.alpha = String(overlay.opacity);
  }

  return [{ type: 'drawtext', values: values as Filter['values'] }];
}
