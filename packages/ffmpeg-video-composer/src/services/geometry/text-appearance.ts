// Colour/backdrop resolution for the geometry model's text boxes, split out of text-boxes.ts to
// keep that file under the max-lines budget. text-boxes.ts owns *where* text lands; this owns
// *what it's drawn on top of* — read by the contrast and over-footage rules in rules.ts.
import { compositeOver, parseColor, rgbToHex } from '@/core/color-contrast';
import {
  CAPTION_DEFAULT_BOX_COLOR,
  CAPTION_DEFAULT_BOX_OPACITY,
  type CaptionStyleValues,
} from '../../editor/presets/caption-layout';
import { OUTLINE_DEFAULTS, SHADOW_DEFAULTS, type TextEffect } from '../../editor/presets/text';
import { LOWER_THIRD_DEFAULT_BAND_COLOR, LOWER_THIRD_DEFAULT_BAND_OPACITY } from './lower-third-layout';

// `shadow`/`outline` as TextEffectSchema has them: `true`, or an object overriding the defaults.
export type TextEffectLike = TextEffect;

// Whether a colour token puts any paint on the frame. A token nobody can read gets the benefit of the
// doubt: the over-footage rule must not invent a finding from a colour it does not understand.
function paints(color: string): boolean {
  const paint = parseColor(color);

  return paint === null || paint.alpha > 0;
}

// A shadow or outline helps only when it draws something. applyTextEffect merges these same defaults
// (`true` or `{}` is a 2px offset / a 2px border), so what draws nothing is an explicit zero offset or
// width, or a fully transparent colour — the same trap as a `boxOpacity: 0` box. Counting any of them
// as an aid silenced the over-footage rule for text with nothing around it at all.
function shadowPaints(shadow: TextEffect['shadow']): boolean {
  if (!shadow) {
    return false;
  }

  const { color, dx, dy } = shadow === true ? SHADOW_DEFAULTS : { ...SHADOW_DEFAULTS, ...shadow };

  return (dx !== 0 || dy !== 0) && paints(color);
}

function outlinePaints(outline: TextEffect['outline']): boolean {
  if (!outline) {
    return false;
  }

  const { color, width } = outline === true ? OUTLINE_DEFAULTS : { ...OUTLINE_DEFAULTS, ...outline };

  return width > 0 && paints(color);
}

function hasLegibilityEffect(effect: TextEffectLike | undefined): boolean {
  return shadowPaints(effect?.shadow) || outlinePaints(effect?.outline);
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

// Everything the renderer paints over — or recolours — the base colour before the text lands, none of
// which this module models: `options.layers` and composited `inputs` (images, animations, full-frame
// by default), the section's authored `filters` (a full-frame `drawbox … t=fill`), a section or
// template-wide `grade`/`look` (background-layer sugar, applied ahead of the text), and `letterbox`
// bars. Scoring text against `backgroundColor` under any of them reported white-on-white at 1.0:1 for
// a caption sitting on a photo, and stayed silent for black text on a graded-down white card.
function backgroundCovered(section: AppearanceSection, global: AppearanceGlobal | undefined): boolean {
  const drawnOver = [section.options?.layers, section.inputs, section.filters].some((list) => (list?.length ?? 0) > 0);
  const recoloured = [section.look, section.grade, section.letterbox, global?.look, global?.grade];

  return drawnOver || recoloured.some((decoration) => decoration !== undefined);
}

// A `color_background` section's colour is a genuine backdrop; any other type may show footage or
// an image underneath, so the honest answer there is "unknown" rather than "none".
//
// `options.backgroundColor` lives on the BASE section schema, so a `project_video` can carry one
// too — it just does not describe what is behind the text there, because the clip is. Every caller
// must go through this gate: compositing a translucent caption box over a footage section's
// `backgroundColor` produced exactly the confident-and-wrong contrast number this module exists to
// avoid. Whatever covers or recolours the base (backgroundCovered) makes it unknown the same way.
function knownSectionBackground(section: AppearanceSection, global: AppearanceGlobal | undefined): string | null {
  if (section.type !== 'color_background' || backgroundCovered(section, global)) {
    return null;
  }

  const background = section.options?.backgroundColor;

  // Parsed here, not just downstream: `null` is this module's "unknowable" sentinel and the
  // over-footage rule keys off it, so a token nobody can read has to land there too. Handing the raw
  // string back let an unparseable-but-truthy colour defeat BOTH rules at once — `0x141416`,
  // `tomato`, `{{ brand }}` — because contrastWarnings bails when parseColor fails while
  // footageLegibilityWarnings bails because the backdrop is not null. A caption with no box, shadow
  // or outline over a background nobody can read then produced no finding at all, which is the exact
  // hole the over-footage rule exists to close.
  return background && parseColor(background) ? background : null;
}

// A translucent paint is only a known backdrop once composited against a known base — treating a
// `boxOpacity: 0.2` box as opaque is exactly the bug this rule exists to catch. An unreadable
// token, or an unknown base behind a translucent one, means the result is unknowable, not a guess.
function resolveBackdrop(token: string | null, sectionBg: string | null): string | null {
  if (!token) {
    return null;
  }

  const paint = parseColor(token);

  if (!paint) {
    return null;
  }

  // Normalised, not the raw token: `#1a1a1a@1` is opaque `#1a1a1a`, and echoing the alpha suffix
  // back into a contrast message ("on #1a1a1a@1") reads as if the alpha mattered to the number.
  if (paint.alpha >= 1) {
    return rgbToHex(paint.rgb);
  }

  const bg = sectionBg ? parseColor(sectionBg) : null;

  if (!bg) {
    return null;
  }

  return rgbToHex(compositeOver(paint, bg.rgb));
}

export interface Appearance {
  color: string | null;
  backdrop: string | null;
  legibilityAid: boolean;
}

export interface CaptionAppearanceInput {
  color?: string;
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number;
  effect?: TextEffectLike;
}

// `boxOpacity: 0` is schema-valid (`z.number().min(0)`) and paints nothing — drawtext still emits a
// `boxcolor` of `…@0`. Returning a truthy token for it made `legibilityAid` true, so the
// over-footage rule stayed silent about text with no visible background at all, while the very same
// caption written `box: false` was flagged. `lowerThirdBandToken` already guards this.
export function captionBoxOpacity(caption: CaptionAppearanceInput): number {
  return caption.boxOpacity ?? CAPTION_DEFAULT_BOX_OPACITY;
}

// Mirrors captions.ts's resolveBox: on when explicitly set or defaulted by the preset; an explicit
// override (or a preset with no box colour) builds a fresh token instead of reusing the preset's.
function captionBoxColorToken(caption: CaptionAppearanceInput, preset: CaptionStyleValues): string | null {
  const boxOn = (caption.box ?? Boolean(preset.box)) && captionBoxOpacity(caption) > 0;

  if (!boxOn) {
    return null;
  }

  const hasOverride = caption.boxColor !== undefined || caption.boxOpacity !== undefined;

  if (!hasOverride && preset.boxcolor !== undefined) {
    return preset.boxcolor;
  }

  return `${caption.boxColor ?? CAPTION_DEFAULT_BOX_COLOR}@${caption.boxOpacity ?? CAPTION_DEFAULT_BOX_OPACITY}`;
}

// A box counts as a legibility aid on its own, even when the composited backdrop still comes out
// unknown (a translucent custom box colour over footage, say).
export function captionAppearance(
  caption: CaptionAppearanceInput,
  preset: CaptionStyleValues,
  section: AppearanceSection,
  global: AppearanceGlobal | undefined
): Appearance {
  const boxToken = captionBoxColorToken(caption, preset);
  const background = knownSectionBackground(section, global);

  return {
    color: caption.color ?? preset.fontcolor,
    backdrop: boxToken ? resolveBackdrop(boxToken, background) : background,
    legibilityAid: Boolean(boxToken) || hasLegibilityEffect(caption.effect),
  };
}

export interface LowerThirdAppearanceInput {
  bandColor?: string;
  boxOpacity?: number;
  effect?: TextEffectLike;
}

// `null` once the author turns the band off (`boxOpacity: 0`).
function lowerThirdBandToken(lowerThird: LowerThirdAppearanceInput): string | null {
  const opacity = lowerThird.boxOpacity ?? LOWER_THIRD_DEFAULT_BAND_OPACITY;

  if (opacity <= 0) {
    return null;
  }

  return `${lowerThird.bandColor ?? LOWER_THIRD_DEFAULT_BAND_COLOR}@${opacity}`;
}

// Shared by a lowerThird's title and subtitle (same band).
export function lowerThirdAppearance(
  lowerThird: LowerThirdAppearanceInput,
  section: AppearanceSection,
  global: AppearanceGlobal | undefined
): { backdrop: string | null; legibilityAid: boolean } {
  const bandToken = lowerThirdBandToken(lowerThird);
  const background = knownSectionBackground(section, global);

  return {
    backdrop: bandToken ? resolveBackdrop(bandToken, background) : background,
    legibilityAid: Boolean(bandToken) || hasLegibilityEffect(lowerThird.effect),
  };
}
