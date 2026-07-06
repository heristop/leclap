// Reverse the drawtext encoding buildDescriptor emits: recover a TextOverlay (position fractions,
// box color/opacity) from a stored section's drawtext filter values.
import type { Section } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { fontIdFromFile, type TextEffect, type TextOverlay } from './model';
import { DEFAULT_BOX_PADDING } from './overlayFilters';

type StoredFilter = NonNullable<Section['filters']>[number];
type DrawtextValues = NonNullable<StoredFilter['values']>;

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

// Recover a [0,1] opacity from a `<hex>@<opacity>` color token; undefined when the token carries
// no alpha suffix or the suffix is unparseable. Shared by the boxcolor and fontcolor paths.
function parseOpacityToken(color: string | undefined): number | undefined {
  const match = /@(\d*\.?\d+)/.exec(color ?? '');

  if (!match) return undefined;

  const value = Number(match[1]);

  if (!Number.isFinite(value)) return undefined;

  return Math.min(1, Math.max(0, value));
}

// Box opacity keeps its historical 0.5 default when the stored boxcolor has no alpha suffix.
function parseOpacity(boxcolor: string | undefined): number {
  return parseOpacityToken(boxcolor) ?? 0.5;
}

// Recover the authored boxPadding from a stored boxborderw: undefined when the box is off, the
// value is absent, equals the historical 12 default, or is non-numeric (the FFmpeg n8.0 per-side
// "up|right|down|left" string — hand-authored only; regenerated builds fall back to uniform padding).
function parseBoxPadding(v: DrawtextValues): number | undefined {
  if (v.box === undefined || v.boxborderw === undefined) return undefined;

  const padding = Number(v.boxborderw);

  if (!Number.isFinite(padding)) return undefined;

  if (padding === DEFAULT_BOX_PADDING) return undefined;

  return Math.max(0, padding);
}

// The engine defaults applyTextEffect bakes in (editor/presets/text.ts); values equal to these
// collapse back to `shadow: true` / `outline: true` so a default effect round-trips unchanged.
const SHADOW_DEFAULTS = { color: '#000000@0.6', dx: 2, dy: 2 };
const OUTLINE_DEFAULTS = { color: '#000000', width: 2 };

// A stored numeric drawtext value, tolerating string encodings; the default when absent/unparseable.
function numOr(value: number | string | undefined, fallback: number): number {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return n;
}

// Recover the shadow half of a TextEffect from stored drawtext keys: absent → undefined,
// all-default → true, otherwise an object carrying only the overridden fields.
function parseShadow(v: DrawtextValues): TextEffect['shadow'] {
  if (v.shadowcolor === undefined) return undefined;

  const dx = numOr(v.shadowx, SHADOW_DEFAULTS.dx);
  const dy = numOr(v.shadowy, SHADOW_DEFAULTS.dy);
  const shadow = {
    ...(v.shadowcolor === SHADOW_DEFAULTS.color ? {} : { color: v.shadowcolor }),
    ...(dx === SHADOW_DEFAULTS.dx ? {} : { dx }),
    ...(dy === SHADOW_DEFAULTS.dy ? {} : { dy }),
  };

  if (Object.keys(shadow).length === 0) return true;

  return shadow;
}

// Recover the outline half of a TextEffect from stored drawtext keys — same collapse rules as parseShadow.
function parseOutline(v: DrawtextValues): TextEffect['outline'] {
  if (v.bordercolor === undefined && v.borderw === undefined) return undefined;

  const width = numOr(v.borderw, OUTLINE_DEFAULTS.width);
  const outline = {
    ...(v.bordercolor === undefined || v.bordercolor === OUTLINE_DEFAULTS.color ? {} : { color: v.bordercolor }),
    ...(width === OUTLINE_DEFAULTS.width ? {} : { width }),
  };

  if (Object.keys(outline).length === 0) return true;

  return outline;
}

// Recover the overlay's TextEffect; undefined when the drawtext carries no shadow/border keys, so
// overlays saved before the effect existed round-trip without a spurious field.
function parseEffect(v: DrawtextValues): TextEffect | undefined {
  const shadow = parseShadow(v);
  const outline = parseOutline(v);

  if (shadow === undefined && outline === undefined) return undefined;

  return { ...(shadow === undefined ? {} : { shadow }), ...(outline === undefined ? {} : { outline }) };
}

export function overlayFrom(dt: {
  values?: DrawtextValues;
  reveal?: TextOverlay['reveal'];
  exit?: TextOverlay['exit'];
}): TextOverlay {
  const v = dt.values ?? {};
  const effect = parseEffect(v);
  // Watermark alpha rides the fontcolor as `#hex@a`; absent suffix → no field, so overlays saved
  // before text opacity existed round-trip without a spurious key.
  const textOpacity = parseOpacityToken(v.fontcolor);
  // Non-default boxborderw rides back as boxPadding; the 12 default collapses to an absent field so
  // overlays saved before the padding control existed round-trip unchanged.
  const boxPadding = parseBoxPadding(v);

  return {
    text: v.text?.en ?? '',
    x: parseFraction(v.x),
    y: parseFraction(v.y),
    fontsize: Number(v.fontsize ?? 48),
    fontcolor: (v.fontcolor ?? '#ffffff').split('@')[0],
    font: fontIdFromFile(v.fontfile),
    box: v.box !== undefined,
    boxcolor: (v.boxcolor ?? '#000000').split('@')[0],
    boxOpacity: parseOpacity(v.boxcolor),
    ...(boxPadding === undefined ? {} : { boxPadding }),
    ...(textOpacity === undefined ? {} : { textOpacity }),
    ...(dt.reveal ? { reveal: dt.reveal } : {}),
    ...(dt.exit ? { exit: dt.exit } : {}),
    ...(effect ? { effect } : {}),
  };
}

// The accent colour when `filter` is a kit-emitted accent bar: the solid drawbox overlayFiltersFrom
// writes right after its drawtext, recognisable by its `(iw-…)*fraction` x anchor (a hand-authored
// wash uses numeric offsets). Geometry is recomputed from the overlay on the next build, so only
// the colour is recovered (minus the fixed `@1` alpha suffix).
function accentFrom(filter: StoredFilter | undefined): string | undefined {
  if (!filter || filter.type !== 'drawbox') return undefined;

  const v = filter.values ?? {};

  if (v.t !== 'fill' || typeof v.c !== 'string') return undefined;

  if (typeof v.x !== 'string' || !v.x.startsWith('(iw-')) return undefined;

  return v.c.split('@')[0];
}

// Section filters → TextOverlays: each drawtext becomes an overlay, and a kit accent drawbox
// immediately after it rides back as the overlay's accent colour. Other filter types pass silently
// (they never described overlays). Shared by the video/color/image section importers.
export function overlaysFromFilters(filters: Section['filters']): TextOverlay[] {
  const list = filters ?? [];

  return list.flatMap((filter, index) => {
    if (filter.type !== 'drawtext') return [];

    const accent = accentFrom(list[index + 1]);

    return [{ ...overlayFrom(filter), ...(accent === undefined ? {} : { accent }) }];
  });
}
