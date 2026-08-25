// Pure colour math for the geometry validator's contrast rules. No FFmpeg, no filesystem, no Node
// globals: this module reaches the browser and React Native builds, and Hermes has no `Buffer`.
//
// The rules this feeds are advisory, so every function here stays honest about what it doesn't
// know: `parseColor` returns `null` for anything unreadable (an unrecognised name, a `{{ var }}`)
// rather than guessing — a guessed colour is a confident, wrong contrast number.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Paint {
  rgb: Rgb;
  alpha: number;
}

// The subset of CSS/FFmpeg named colours this codebase's descriptors/presets actually emit.
// Anything else must be a hex token.
const NAMED_COLORS: Record<string, Rgb> = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
  yellow: { r: 255, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  green: { r: 0, g: 128, b: 0 },
};

const HEX6 = /^#([0-9a-fA-F]{6})$/;
const HEX3 = /^#([0-9a-fA-F]{3})$/;

function parseHex(base: string): Rgb | null {
  const six = HEX6.exec(base);

  if (six) {
    const hex = six[1];

    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const three = HEX3.exec(base);

  if (!three) {
    return null;
  }

  const hex = three[1];

  return {
    r: Number.parseInt(hex[0] + hex[0], 16),
    g: Number.parseInt(hex[1] + hex[1], 16),
    b: Number.parseInt(hex[2] + hex[2], 16),
  };
}

function parseBaseColor(base: string): Rgb | null {
  const hex = parseHex(base);

  if (hex) {
    return hex;
  }

  return NAMED_COLORS[base.toLowerCase()] ?? null;
}

// No `@alpha` suffix means fully opaque; a suffix that isn't a number invalidates the whole token.
function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) {
    return 1;
  }

  const value = Number.parseFloat(token);

  if (Number.isNaN(value)) {
    return null;
  }

  return Math.min(1, Math.max(0, value));
}

/**
 * Parses an FFmpeg colour token — `#RRGGBB`, `#RRGGBB@alpha`, `#RGB`, or a common named colour —
 * into an RGB + alpha pair. Returns `null` for anything else, including a `{{ variable }}`.
 */
export function parseColor(token: string): Paint | null {
  if (typeof token !== 'string' || token.includes('{{')) {
    return null;
  }

  const trimmed = token.trim();
  const at = trimmed.indexOf('@');
  const base = at === -1 ? trimmed : trimmed.slice(0, at);
  const alphaToken = at === -1 ? undefined : trimmed.slice(at + 1);

  const rgb = parseBaseColor(base);
  const alpha = parseAlpha(alphaToken);

  if (!rgb || alpha === null) {
    return null;
  }

  return { rgb, alpha };
}

/** Composites a translucent paint over an opaque background, per channel: `fg*alpha + bg*(1-alpha)`. */
export function compositeOver(fg: Paint, bg: Rgb): Rgb {
  return {
    r: fg.rgb.r * fg.alpha + bg.r * (1 - fg.alpha),
    g: fg.rgb.g * fg.alpha + bg.g * (1 - fg.alpha),
    b: fg.rgb.b * fg.alpha + bg.b * (1 - fg.alpha),
  };
}

function linearizeChannel(channel255: number): number {
  const c = channel255 / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearizeChannel(rgb.r) + 0.7152 * linearizeChannel(rgb.g) + 0.0722 * linearizeChannel(rgb.b);
}

/** WCAG 2.1 contrast ratio, always >= 1 and order-independent: `(Llighter+0.05)/(Ldarker+0.05)`. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);

  return (lighter + 0.05) / (darker + 0.05);
}

function toHexChannel(value: number): string {
  const clamped = Math.min(255, Math.max(0, Math.round(value)));

  return clamped.toString(16).padStart(2, '0');
}

/** Serialises a composited RGB result back into a `#rrggbb` token, re-parseable by parseColor. */
export function rgbToHex(rgb: Rgb): string {
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
}
