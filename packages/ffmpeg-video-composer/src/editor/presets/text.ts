import { findFont } from '@leclap/creative-kit/fonts';

export type Translation = Record<string, string | undefined>;

// Resolve a font id (bundled registry) or raw .ttf filename to a drawtext fontfile, falling back to
// the given preset file. Shared by every text sugar so font handling lives in one place.
export function resolveFontFile(font: string | undefined, presetFile: string): string {
  if (!font) {
    return presetFile;
  }

  const entry = findFont(font);

  if (entry) {
    return entry.file;
  }

  if (font.endsWith('.ttf')) {
    return font;
  }

  return presetFile;
}

// ---------------------------------------------------------------------------
// reveal — animated entrance for sugar text (caption / titleCard / lowerThird)
// ---------------------------------------------------------------------------
//
// Authors hand-wrote drawtext `alpha` and kinetic `x`/`y` `t`-expressions for every animated entrance
// (45+ across the bundled templates, one shipped with a syntax bug). `revealToExpr` GENERATES those
// expressions from a small intent — `{ type, delay, duration, distance }` — so the sugar tiers never
// hand-author timing math. Pure and string-deterministic, so the exact output is unit-tested.

export const REVEAL_TYPES = ['none', 'fade', 'rise', 'slide-left', 'slide-right'] as const;
export type RevealType = (typeof REVEAL_TYPES)[number];

export type Reveal = {
  type: RevealType;
  /** Seconds before the entrance starts (default 0.3). */
  delay?: number;
  /** Seconds the entrance takes (default 0.6). */
  duration?: number;
  /** Pixels the text travels for rise/slide entrances (default 60). */
  distance?: number;
};

/** A reveal authored either as the bare type ("rise") or the full object. */
export type RevealInput = RevealType | Reveal;

// drawtext expressions produced by a reveal: an `alpha` ramp and, for moving entrances, an `x`/`y`
// override. Each is already single-quoted because it contains commas, which would otherwise be read
// as filter-option separators.
export type RevealExprs = {
  alpha?: string;
  x?: string;
  y?: string;
};

const DEFAULT_DELAY = 0.3;
const DEFAULT_DURATION = 0.6;
const DEFAULT_DISTANCE = 60;
const STAGGER_STEP = 0.15;

// Minimal decimal rendering: 0.3 → "0.3", 0.9 → "0.9", avoiding 0.1+0.2 → "0.30000000000000004".
function num(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function normalize(input: RevealInput): Reveal {
  if (typeof input === 'string') {
    return { type: input };
  }

  return input;
}

// 0 before `delay`, a linear 0→1 ramp across `duration`, then 1 — the shape of both the alpha
// fade-in and the motion progress. Unquoted; callers wrap it.
function ramp(delay: number, duration: number): string {
  const end = num(delay + duration);

  return `if(lt(t,${num(delay)}),0,if(lt(t,${end}),(t-${num(delay)})/${num(duration)},1))`;
}

// A position expression that starts `distance` px off `base` (on the `sign` side) and eases to `base`
// as the ramp completes. `base` may be a number or an ffmpeg expression, so it is parenthesised.
function offset(base: string | number, sign: '+' | '-', distance: number, rampExpr: string): string {
  return `'(${base})${sign}(1-(${rampExpr}))*${num(distance)}'`;
}

/**
 * Translates a reveal intent into the drawtext expressions an animated entrance needs.
 *
 * - `none` → no expressions (the text is drawn statically).
 * - `fade` → an `alpha` ramp only.
 * - `rise` → `alpha` + a `y` that lifts the text up into place from `distance` px below.
 * - `slide-left` → `alpha` + an `x` entering from `distance` px to the right.
 * - `slide-right` → `alpha` + an `x` entering from `distance` px to the left.
 *
 * `base` is the text's resting position; motion expressions ease from the offset back to it.
 */
export function revealToExpr(input: RevealInput | undefined, base: { x: string | number; y: string | number }): RevealExprs {
  if (input === undefined) {
    return {};
  }

  const reveal = normalize(input);

  if (reveal.type === 'none') {
    return {};
  }

  const delay = reveal.delay ?? DEFAULT_DELAY;
  const duration = reveal.duration ?? DEFAULT_DURATION;
  const distance = reveal.distance ?? DEFAULT_DISTANCE;
  const rampExpr = ramp(delay, duration);
  const alpha = `'${rampExpr}'`;

  if (reveal.type === 'fade') {
    return { alpha };
  }

  if (reveal.type === 'rise') {
    return { alpha, y: offset(base.y, '+', distance, rampExpr) };
  }

  if (reveal.type === 'slide-left') {
    return { alpha, x: offset(base.x, '+', distance, rampExpr) };
  }

  return { alpha, x: offset(base.x, '-', distance, rampExpr) };
}

// ---------------------------------------------------------------------------
// shared text-block helpers
// ---------------------------------------------------------------------------

// True when a Translation has at least one non-blank value.
export function hasText(text: Translation | undefined): boolean {
  return text !== undefined && Object.values(text).some((value) => typeof value === 'string' && value.trim() !== '');
}

// Merges a reveal's alpha/x/y expressions onto a drawtext values object (mutating it). Shared by
// every text sugar so the reveal wiring lives in exactly one place.
export function applyReveal(
  values: Record<string, unknown>,
  reveal: RevealInput | undefined,
  base: { x: string | number; y: string | number }
): void {
  const exprs = revealToExpr(reveal, base);

  if (exprs.alpha) {
    values.alpha = exprs.alpha;
  }

  if (exprs.x) {
    values.x = exprs.x;
  }

  if (exprs.y) {
    values.y = exprs.y;
  }
}

// Shifts a reveal's delay by its line index so stacked lines enter in sequence.
export function staggered(reveal: RevealInput, index: number): Reveal {
  const obj = normalize(reveal);
  const baseDelay = obj.delay ?? DEFAULT_DELAY;

  return { ...obj, delay: Number((baseDelay + index * STAGGER_STEP).toFixed(4)) };
}
