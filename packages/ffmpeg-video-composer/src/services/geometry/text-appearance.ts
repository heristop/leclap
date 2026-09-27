// What a piece of text is drawn over, and whether it carries its own legibility aid — read off the
// drawtext/drawbox values the renderer emits (see draw-layers.ts), not re-derived per preset. Feeds
// the contrast and over-footage rules in rules.ts.
import { compositeOver, parseColor, rgbToHex } from '@/core/color-contrast';

// Whether a colour token puts any paint on the frame. A token nobody can read gets the benefit of the
// doubt: the over-footage rule must not invent a finding from a colour it does not understand.
export function paints(color: unknown): boolean {
  if (typeof color !== 'string') {
    return false;
  }

  const paint = parseColor(color);

  return paint === null || paint.alpha > 0;
}

// drawtext takes `box=1`, `borderw=2`, … as numbers or numeric strings.
function positive(value: unknown): boolean {
  const number = Number(value);

  return value !== undefined && value !== null && Number.isFinite(number) && number !== 0;
}

// drawtext's own aids: its background box, a border (outline) or a shadow — each only when it draws
// something. An explicit zero width/offset or a fully transparent colour paints nothing, the same trap
// as a `boxOpacity: 0` box, and counting it silenced the over-footage rule for bare text.
export function boxPaints(values: Record<string, unknown>): boolean {
  return positive(values.box) && paints(values.boxcolor ?? 'white');
}

export function hasLegibilityAid(values: Record<string, unknown>): boolean {
  const outline = positive(values.borderw) && paints(values.bordercolor ?? 'black');
  const shadow = (positive(values.shadowx) || positive(values.shadowy)) && paints(values.shadowcolor ?? 'black');

  return boxPaints(values) || outline || shadow;
}

// Loose section shape: the fields that decide what a section's text is drawn over.
export interface AppearanceSection {
  type?: string;
  options?: {
    backgroundColor?: string;
    layers?: unknown[];
  };
  inputs?: unknown[];
  filters?: unknown[];
  look?: unknown;
  grade?: unknown;
  letterbox?: unknown;
}

// The template-wide decorations that recolour every section (compileGlobalDecorations).
export interface AppearanceGlobal {
  look?: unknown;
  grade?: unknown;
}

// Authored drawtext/drawbox filters are modelled layer by layer (draw-layers.ts); anything else an
// author writes (eq, overlay, hue, …) recolours the frame in ways this module cannot follow.
function unmodelledFilter(filter: unknown): boolean {
  const type = (filter as { type?: unknown } | null)?.type;

  return type !== 'drawtext' && type !== 'drawbox';
}

// Everything the renderer paints over — or recolours — the base colour that this module does not
// model: `options.layers` and composited `inputs` (images, animations, full-frame by default), authored
// filters other than drawtext/drawbox, a section or template-wide `grade`/`look`, and `letterbox`
// bars. Scoring text against `backgroundColor` under any of them reported white-on-white at 1.0:1 for
// a caption sitting on a photo.
function backgroundCovered(section: AppearanceSection, global: AppearanceGlobal | undefined): boolean {
  const drawnOver = [section.options?.layers, section.inputs].some((list) => (list?.length ?? 0) > 0);
  const filtered = Array.isArray(section.filters) && section.filters.some(unmodelledFilter);
  const recoloured = [section.look, section.grade, section.letterbox, global?.look, global?.grade];

  return drawnOver || filtered || recoloured.some((decoration) => decoration !== undefined);
}

// A `color_background` section's colour is a genuine backdrop; any other type may show footage or an
// image underneath, so the honest answer there is "unknown" (null) rather than "none". Parsed here so
// an unreadable token (`tomato`, `{{ brand }}`) lands on the same "unknown" sentinel the over-footage
// rule keys off, instead of defeating both colour rules at once.
export function sectionBackdrop(section: AppearanceSection, global: AppearanceGlobal | undefined): string | null {
  if (section.type !== 'color_background' || backgroundCovered(section, global)) {
    return null;
  }

  const background = section.options?.backgroundColor;

  return background && parseColor(background) ? background : null;
}

// Paint `token` over `base`. An opaque paint is known whatever lies beneath; a translucent one only
// over a known base. Unreadable or unknowable stays null — never a guess. Normalised to `#rrggbb` so a
// message never echoes an alpha suffix as if it mattered to the number.
export function paintOver(token: unknown, base: string | null): string | null {
  const paint = typeof token === 'string' ? parseColor(token) : null;

  if (!paint) {
    return null;
  }

  if (paint.alpha >= 1) {
    return rgbToHex(paint.rgb);
  }

  const under = base ? parseColor(base) : null;

  return under ? rgbToHex(compositeOver(paint, under.rgb)) : null;
}
