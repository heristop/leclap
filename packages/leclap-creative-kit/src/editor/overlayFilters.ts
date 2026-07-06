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

// The boxborderw the kit has always emitted; overlays without an authored boxPadding keep it, and
// a parsed value equal to it collapses back to an absent field (see overlayParsing). Exported so
// the web canvas preview pads its CSS box with the exact same default.
export const DEFAULT_BOX_PADDING = 12;

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
      ...(overlay.box
        ? { box: 1, boxcolor: `${overlay.boxcolor}@${overlay.boxOpacity}`, boxborderw: overlay.boxPadding ?? DEFAULT_BOX_PADDING }
        : {}),
      ...effectValues(overlay.effect),
    },
    // The entrance/exit animations ride as sibling `reveal`/`exit` the engine bakes onto the drawtext;
    // x/y stay the base fractions so the overlay still round-trips through overlayFrom.
    ...(overlay.reveal ? { reveal: overlay.reveal } : {}),
    ...(overlay.exit ? { exit: overlay.exit } : {}),
  };
}

// Default reveal delay, mirroring the engine's DEFAULT_DELAY (editor/presets/text.ts). The kit
// round-trip test pins the emitted gate so an engine-side change is caught.
const REVEAL_DEFAULT_DELAY = 0.3;

// The timeline gate keeping the accent bar in step with its drawtext's reveal: drawbox has no alpha
// expression, so the bar pops in at the reveal delay (`enable='gte(t,delay)'`, pre-quoted because
// the expression holds a comma) instead of sitting on screen before its text. No reveal / `none` /
// a zero delay emit nothing, so existing descriptors stay byte-identical.
function accentEnable(reveal: TextOverlay['reveal']): string | undefined {
  if (!reveal) return undefined;

  const obj = typeof reveal === 'string' ? { type: reveal } : reveal;

  if (obj.type === 'none') return undefined;

  const delay = 'delay' in obj && obj.delay !== undefined ? obj.delay : REVEAL_DEFAULT_DELAY;

  if (delay <= 0) return undefined;

  return `'gte(t,${Number(delay.toFixed(4))})'`;
}

// The accent underline bar beneath the text — the title-card treatment (engine text-blocks.ts
// accentBar) for a positionable overlay. The kit never knows the output size, so the geometry uses
// the drawbox expression vocabulary (iw/ih) mirroring the drawtext `(w-text_w)*fraction` anchor:
// width ≈ 6× the fontsize centered on the x anchor, height max(4, fontsize*0.12), sitting one
// approximated text height (fontsize*1.2) plus a small gap below the y anchor. The bar is emitted
// right AFTER its drawtext so overlayParsing can recover the pair by adjacency; the geometry is
// recomputed on every build, so only the colour needs to round-trip. A revealed overlay gates the
// bar with the reveal delay (accentEnable) so it enters with its text.
function accentBarFilters(overlay: TextOverlay): StoredFilter[] {
  if (!overlay.accent) return [];

  const textH = Math.round(overlay.fontsize * 1.2);
  const barW = Math.round(overlay.fontsize * 6);
  const barH = Math.max(4, Math.round(overlay.fontsize * 0.12));
  const gap = Math.round(overlay.fontsize * 0.25);
  const enable = accentEnable(overlay.reveal);

  return [
    {
      type: 'drawbox',
      values: {
        x: `(iw-${barW})*${roundFraction(overlay.x)}`,
        y: `(ih-${textH})*${roundFraction(overlay.y)}+${textH + gap}`,
        w: barW,
        h: barH,
        c: `${overlay.accent}@1`,
        t: 'fill',
        ...(enable === undefined ? {} : { enable }),
      },
    },
  ];
}

// Non-empty text overlays → drawtext filters (each followed by its optional accent bar), in author
// order. Shared by video/color/image sections; tolerant of an absent list (older states / sections
// built before overlays existed on this kind).
export function overlayFiltersFrom(overlays: TextOverlay[] | undefined): StoredFilter[] {
  return (overlays ?? [])
    .filter((o) => o.text.trim() !== '')
    .flatMap((o) => [drawtextFilterFrom(o), ...accentBarFilters(o)]);
}
