// Pure: text overlays -> drawtext filters for the descriptor. Shared by the video/color/image
// section builders.
import type { Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { findFont } from '../fonts';
import type { TextEffect, TextOverlay } from './model';

type StoredFilter = NonNullable<Section['filters']>[number];
type StoredValues = NonNullable<StoredFilter['values']>;

// Mirrors applyTextEffect in the engine (editor/presets/text.ts) — kept local because that module
// resolves through the engine's `@/` alias, which the web bundle cannot import. The kit round-trip
// test pins these exact defaults so any engine-side change is caught.
const SHADOW_DEFAULTS = { color: '#000000@0.6', dx: 2, dy: 2 };
const OUTLINE_DEFAULTS = { color: '#000000', width: 2 };

// Lower a TextEffect to the drawtext shadow/border keys; empty when the overlay has no effect,
// so older overlays keep emitting the exact same filter values.
function effectValues(
  effect: TextEffect | undefined
): Pick<StoredValues, 'shadowcolor' | 'shadowx' | 'shadowy' | 'bordercolor' | 'borderw'> {
  if (!effect) return {};

  const values: Pick<StoredValues, 'shadowcolor' | 'shadowx' | 'shadowy' | 'bordercolor' | 'borderw'> = {};

  if (effect.shadow) {
    const shadow = effect.shadow === true ? SHADOW_DEFAULTS : { ...SHADOW_DEFAULTS, ...effect.shadow };
    values.shadowcolor = shadow.color;
    values.shadowx = shadow.dx;
    values.shadowy = shadow.dy;
  }

  if (effect.outline) {
    const outline = effect.outline === true ? OUTLINE_DEFAULTS : { ...OUTLINE_DEFAULTS, ...effect.outline };
    values.bordercolor = outline.color;
    values.borderw = outline.width;
  }

  return values;
}

// Clamp a 0–1 position fraction and round to 3 decimals for stable filter expressions.
function roundFraction(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return Math.round(clamped * 1000) / 1000;
}

// fontcolor with the optional watermark alpha riding as a `@a` suffix — the same token boxcolor
// uses — instead of the drawtext `alpha` option, which FilterManager.bakeTextAnimation overwrites
// with the reveal/exit expression. Opacity-less overlays keep emitting the bare color unchanged.
function fontcolorFrom(overlay: TextOverlay): string {
  if (overlay.textOpacity === undefined) return overlay.fontcolor;

  return `${overlay.fontcolor}@${overlay.textOpacity}`;
}

// A drawtext filter for one overlay. Box keys are only added when the overlay
// opts into a background box; boxcolor carries the author-set opacity suffix.
function drawtextFilterFrom(overlay: TextOverlay): StoredFilter {
  return {
    type: 'drawtext',
    values: {
      text: { en: overlay.text },
      fontsize: overlay.fontsize,
      fontcolor: fontcolorFrom(overlay),
      fontfile: findFont(overlay.font)?.file ?? 'Rubik.ttf',
      x: `(w-text_w)*${roundFraction(overlay.x)}`,
      y: `(h-text_h)*${roundFraction(overlay.y)}`,
      ...(overlay.box ? { box: 1, boxcolor: `${overlay.boxcolor}@${overlay.boxOpacity}`, boxborderw: 12 } : {}),
      ...effectValues(overlay.effect),
    },
    // The entrance/exit animations ride as sibling `reveal`/`exit` the engine bakes onto the drawtext;
    // x/y stay the base fractions so the overlay still round-trips through overlayFrom.
    ...(overlay.reveal ? { reveal: overlay.reveal } : {}),
    ...(overlay.exit ? { exit: overlay.exit } : {}),
  };
}

// Non-empty text overlays → drawtext filters, in author order. Shared by video/color/image sections;
// tolerant of an absent list (older states / sections built before overlays existed on this kind).
export function overlayFiltersFrom(overlays: TextOverlay[] | undefined): StoredFilter[] {
  return (overlays ?? []).filter((o) => o.text.trim() !== '').map(drawtextFilterFrom);
}
