import type { Filter } from '@/core/types';
import type { Caption } from '../../schemas/section.schemas';
import { findFont } from '@leclap/creative-kit/fonts';

// ---------------------------------------------------------------------------
// captionToFilters
// ---------------------------------------------------------------------------

// Vertical placement expressions. y is the preset offset.
const POSITION_Y: Record<string, string> = {
  top: '60',
  center: '(h-text_h)/2',
  bottom: '(h-text_h)-60',
  'lower-third': '(h-text_h)-110',
};

const DEFAULT_POSITION = 'lower-third';

// Horizontal alignment expressions. `left`/`right` use an 80px margin to match the
// premium templates' convention; `center` is the classic centred drawtext expression.
const ALIGN_MARGIN = 80;
const ALIGN_X: Record<string, string> = {
  left: String(ALIGN_MARGIN),
  center: '(w-text_w)/2',
  right: `w-text_w-${ALIGN_MARGIN}`,
};

const DEFAULT_ALIGN = 'center';

type StyleValues = {
  fontfile: string;
  fontsize: number;
  fontcolor: string;
  box?: number;
  boxcolor?: string;
  boxborderw?: number;
};

// Fixed look per style preset. `bar` is a boxed lower-third; `subtle`/`bold`
// draw no background box.
const STYLE_VALUES: Record<string, StyleValues> = {
  bar: {
    fontfile: 'Oswald.ttf',
    fontsize: 46,
    fontcolor: '#f5f5f0',
    box: 1,
    boxcolor: '#141416@0.8',
    boxborderw: 18,
  },
  subtle: {
    fontfile: 'Rubik.ttf',
    fontsize: 44,
    fontcolor: '#ffffff',
  },
  bold: {
    fontfile: 'BebasNeue.ttf',
    fontsize: 72,
    fontcolor: '#ffffff',
  },
};

const DEFAULT_STYLE = 'bar';

// Box defaults applied when the caption explicitly turns a box ON but the preset had none.
const DEFAULT_BOX_COLOR = '#000000';
const DEFAULT_BOX_OPACITY = 0.8;
const DEFAULT_BOX_BORDER = 18;

// True when the caption has at least one non-blank translation value.
function hasText(text: Caption['text']): boolean {
  return Object.values(text).some((value) => typeof value === 'string' && value.trim() !== '');
}

// Resolve the caption `font` override to a drawtext fontfile. A known font id maps
// through the bundled registry; a raw .ttf passes through unchanged (mirrors the
// editor's findFont contract); anything else falls back to the preset's fontfile.
function resolveFontFile(font: string | undefined, presetFile: string): string {
  if (!font) return presetFile;

  const entry = findFont(font);

  if (entry) return entry.file;

  if (font.endsWith('.ttf')) return font;

  return presetFile;
}

// Resolve the box drawtext values, layering caption overrides over the preset. Returns the empty
// object when the box is off (preset default unless the caption explicitly toggles it). An explicit
// boxColor/boxOpacity override (or a preset with no box) builds a fresh `#rrggbb@opacity` token;
// otherwise the preset token is reused.
function resolveBox(caption: Caption, preset: StyleValues): Record<string, unknown> {
  const boxOn = caption.box ?? Boolean(preset.box);

  if (!boxOn) return {};

  const hasOverride = caption.boxColor !== undefined || caption.boxOpacity !== undefined;
  const boxcolor =
    hasOverride || preset.boxcolor === undefined
      ? `${caption.boxColor ?? DEFAULT_BOX_COLOR}@${caption.boxOpacity ?? DEFAULT_BOX_OPACITY}`
      : preset.boxcolor;

  return { box: 1, boxcolor, boxborderw: preset.boxborderw ?? DEFAULT_BOX_BORDER };
}

/**
 * Translates a Caption descriptor into a single styled drawtext Filter.
 * Returns [] when undefined or when the text has no non-blank translation.
 *
 * The chosen `style` preset provides base look values; the optional
 * align/font/fontsize/color/box/boxColor/boxOpacity fields override them so a
 * caption can match a bespoke look while staying structured sugar.
 *
 * The Translation `text` is emitted untouched onto `values.text` — FormatterManager
 * resolves the active locale, substitutes {{ variables }}, and escapes the string
 * downstream (the same text path every drawtext filter goes through).
 */
export function captionToFilters(caption?: Caption): Filter[] {
  if (!caption || !hasText(caption.text)) {
    return [];
  }

  const y = POSITION_Y[caption.position ?? DEFAULT_POSITION];
  const x = ALIGN_X[caption.align ?? DEFAULT_ALIGN];
  const preset = STYLE_VALUES[caption.style ?? DEFAULT_STYLE];

  const values: Record<string, unknown> = {
    text: { ...caption.text },
    x,
    y,
    fontfile: resolveFontFile(caption.font, preset.fontfile),
    fontsize: caption.fontsize ?? preset.fontsize,
    fontcolor: caption.color ?? preset.fontcolor,
    ...resolveBox(caption, preset),
  };

  return [
    {
      type: 'drawtext',
      values: values as Filter['values'],
    },
  ];
}
