import type { Filter } from '@/core/types';
import type { Caption } from '../../schemas/section.schemas';
import {
  CAPTION_ALIGN_MARGIN,
  CAPTION_ANCHOR_Y,
  CAPTION_DEFAULT_ALIGN,
  CAPTION_DEFAULT_BOX_BORDER,
  CAPTION_DEFAULT_BOX_COLOR,
  CAPTION_DEFAULT_BOX_OPACITY,
  CAPTION_DEFAULT_POSITION,
  captionStyleValues,
  type CaptionStyleValues,
} from './caption-layout';
import { applyReveal, applyTextEffect, hasText, resolveFontFile } from './text';

// ---------------------------------------------------------------------------
// captionToFilters
// ---------------------------------------------------------------------------

// Vertical placement expressions, built from the shared anchors in caption-layout.ts so the geometry
// validator resolves the same numbers this stringifies. `center` centres the drawn box, which is why
// it subtracts `text_h` rather than sitting at `h/2`.
const POSITION_Y: Record<string, string> = {
  top: String(CAPTION_ANCHOR_Y.top.offset),
  center: '(h-text_h)/2',
  bottom: `(h-text_h)-${CAPTION_ANCHOR_Y.bottom.offset}`,
  'lower-third': `(h-text_h)-${CAPTION_ANCHOR_Y['lower-third'].offset}`,
};

const DEFAULT_POSITION = CAPTION_DEFAULT_POSITION;

// Horizontal alignment expressions; `center` is the classic centred drawtext expression.
const ALIGN_X: Record<string, string> = {
  left: String(CAPTION_ALIGN_MARGIN),
  center: '(w-text_w)/2',
  right: `w-text_w-${CAPTION_ALIGN_MARGIN}`,
};

const DEFAULT_ALIGN = CAPTION_DEFAULT_ALIGN;

type StyleValues = CaptionStyleValues;

// Box defaults applied when the caption explicitly turns a box ON but the preset had none.
const DEFAULT_BOX_COLOR = CAPTION_DEFAULT_BOX_COLOR;
const DEFAULT_BOX_OPACITY = CAPTION_DEFAULT_BOX_OPACITY;
const DEFAULT_BOX_BORDER = CAPTION_DEFAULT_BOX_BORDER;

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
  const preset = captionStyleValues(caption.style);

  const values: Record<string, unknown> = {
    text: { ...caption.text },
    x,
    y,
    fontfile: resolveFontFile(caption.font, preset.fontfile),
    fontsize: caption.fontsize ?? preset.fontsize,
    fontcolor: caption.color ?? preset.fontcolor,
    ...resolveBox(caption, preset),
  };

  applyTextEffect(values, caption.effect);

  // An optional reveal overrides x/y with kinetic expressions and adds the alpha fade-in.
  applyReveal(values, caption.reveal, { x, y });

  return [
    {
      type: 'drawtext',
      values,
    },
  ];
}
