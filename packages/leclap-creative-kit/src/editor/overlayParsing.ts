// Reverse the drawtext encoding buildDescriptor emits: recover a TextOverlay (position fractions,
// box color/opacity) from a stored section's drawtext filter values.
import type { Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { fontIdFromFile, type TextOverlay } from './model';

type DrawtextValues = NonNullable<NonNullable<Section['filters']>[number]['values']>;

// Recover the [0,1] position fraction from a stored drawtext x/y expression of the
// `(w-text_w)*<frac>` form; the legacy `(…)/2` centered form (or anything unparseable) → 0.5.
export function parseFraction(value?: string | number): number {
  if (typeof value !== 'string') return 0.5;

  const match = /\)\s*\*\s*(\d*\.?\d+)/.exec(value);

  if (!match) return 0.5;

  const fraction = Number(match[1]);

  if (!Number.isFinite(fraction)) return 0.5;

  return Math.min(1, Math.max(0, fraction));
}

// Recover the [0,1] box opacity from a stored `<hex>@<opacity>` boxcolor; 0.5 when absent/unparseable.
function parseOpacity(boxcolor: string | undefined): number {
  const match = /@(\d*\.?\d+)/.exec(boxcolor ?? '');

  if (!match) return 0.5;

  const value = Number(match[1]);

  if (!Number.isFinite(value)) return 0.5;

  return Math.min(1, Math.max(0, value));
}

export function overlayFrom(dt: { values?: DrawtextValues }): TextOverlay {
  const v = dt.values ?? {};

  return {
    text: v.text?.en ?? '',
    x: parseFraction(v.x),
    y: parseFraction(v.y),
    fontsize: Number(v.fontsize ?? 48),
    fontcolor: v.fontcolor ?? '#ffffff',
    font: fontIdFromFile(v.fontfile),
    box: v.box !== undefined,
    boxcolor: (v.boxcolor ?? '#000000').split('@')[0],
    boxOpacity: parseOpacity(v.boxcolor),
  };
}
