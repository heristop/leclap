// Pure helpers for the stat "count-up" roll-up — split a display value into its animatable numeric
// part and the surrounding text, ease the running count, and format it back. No React, so the maths
// unit-tests cleanly and the About stats can roll up on view without a numeric-parsing surprise.

export interface ParsedCount {
  /** The magnitude to count up to, or null when the value carries no number (e.g. "∞"). */
  target: number | null;
  /** Text before the number (e.g. a leading symbol). */
  prefix: string;
  /** Text after the number (e.g. "%", "K+"). */
  suffix: string;
  /** Decimal places to preserve when formatting the running value. */
  decimals: number;
}

// Optional leading text, a signed integer/decimal, then any trailing text (the unit/suffix).
const NUMBER_RE = /^(\D*)(-?\d+(?:\.\d+)?)(.*)$/s;

// Split a display value like "100%" or "1.5K+" into its number and surrounding text; a value with no
// number (like "∞" or "0") short-circuits — "∞" returns a null target so callers render it verbatim.
export const parseCount = (raw: string): ParsedCount => {
  const match = NUMBER_RE.exec(raw);

  if (!match) {
    return { target: null, prefix: raw, suffix: '', decimals: 0 };
  }

  const [, prefix, numberText, suffix] = match;
  const dot = numberText.indexOf('.');

  return {
    target: Number(numberText),
    prefix,
    suffix,
    decimals: dot === -1 ? 0 : numberText.length - dot - 1,
  };
};

// Ease-out-expo — matches the app's --ease-out-expo curve so the roll-up decelerates like the rest of
// the motion system. Clamped to 0..1.
export const easeOutExpo = (progress: number): number => {
  if (progress <= 0) return 0;

  if (progress >= 1) return 1;

  return 1 - 2 ** (-10 * progress);
};

// The counted value at linear progress 0..1, eased and rounded to `decimals`.
export const countAtProgress = (target: number, progress: number, decimals = 0): number => {
  const factor = 10 ** decimals;

  return Math.round(target * easeOutExpo(progress) * factor) / factor;
};

// Format a running number back into the parsed value's display string (prefix + number + suffix).
export const formatCount = (parsed: ParsedCount, value: number): string =>
  `${parsed.prefix}${value.toFixed(parsed.decimals)}${parsed.suffix}`;
