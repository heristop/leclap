// Colour/backdrop resolution for the geometry model's text boxes, split out of text-boxes.ts to
// keep that file under the max-lines budget. text-boxes.ts owns *where* text lands; this owns
// *what it's drawn on top of* — read by the contrast and over-footage rules in rules.ts.
import { compositeOver, parseColor, rgbToHex } from '@/core/color-contrast';
import {
  CAPTION_DEFAULT_BOX_COLOR,
  CAPTION_DEFAULT_BOX_OPACITY,
  type CaptionStyleValues,
} from '@/editor/presets/caption-layout';

// `shadow`/`outline` are `boolean | object` on TextEffectSchema; all this needs is whether either
// is present at all.
export interface TextEffectLike {
  shadow?: unknown;
  outline?: unknown;
}

function hasLegibilityEffect(effect: TextEffectLike | undefined): boolean {
  return Boolean(effect?.shadow) || Boolean(effect?.outline);
}

// Loose section shape matching text-boxes.ts's CaptionedSection.
export interface AppearanceSection {
  type?: string;
  options?: {
    backgroundColor?: string;
  };
}

// The section's own solid background colour, or `null` when unset.
function sectionBackgroundColor(section: AppearanceSection): string | null {
  return section.options?.backgroundColor ?? null;
}

// A `color_background` section's colour is a genuine backdrop; any other type may show footage or
// an image underneath, so the honest answer there is "unknown" rather than "none".
function knownSectionBackground(section: AppearanceSection): string | null {
  if (section.type !== 'color_background') {
    return null;
  }

  return sectionBackgroundColor(section);
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

  if (paint.alpha >= 1) {
    return token;
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

// Mirrors captions.ts's resolveBox: on when explicitly set or defaulted by the preset; an explicit
// override (or a preset with no box colour) builds a fresh token instead of reusing the preset's.
function captionBoxColorToken(caption: CaptionAppearanceInput, preset: CaptionStyleValues): string | null {
  const boxOn = caption.box ?? Boolean(preset.box);

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
  section: AppearanceSection
): Appearance {
  const boxToken = captionBoxColorToken(caption, preset);
  const backdrop = boxToken
    ? resolveBackdrop(boxToken, sectionBackgroundColor(section))
    : knownSectionBackground(section);

  return {
    color: caption.color ?? preset.fontcolor,
    backdrop,
    legibilityAid: Boolean(boxToken) || hasLegibilityEffect(caption.effect),
  };
}

export interface LowerThirdAppearanceInput {
  bandColor?: string;
  boxOpacity?: number;
  effect?: TextEffectLike;
}

// `null` once the author turns the band off (`boxOpacity: 0`).
function lowerThirdBandToken(lowerThird: LowerThirdAppearanceInput, defaultColor: string, defaultOpacity: number) {
  const opacity = lowerThird.boxOpacity ?? defaultOpacity;

  if (opacity <= 0) {
    return null;
  }

  return `${lowerThird.bandColor ?? defaultColor}@${opacity}`;
}

// Shared by a lowerThird's title and subtitle (same band). `defaultColor`/`defaultOpacity` are
// passed in so this module stays free of the lowerThird preset's own layout constants.
export function lowerThirdAppearance(
  lowerThird: LowerThirdAppearanceInput,
  section: AppearanceSection,
  defaultColor: string,
  defaultOpacity: number
): { backdrop: string | null; legibilityAid: boolean } {
  const bandToken = lowerThirdBandToken(lowerThird, defaultColor, defaultOpacity);
  const backdrop = bandToken
    ? resolveBackdrop(bandToken, sectionBackgroundColor(section))
    : knownSectionBackground(section);

  return {
    backdrop,
    legibilityAid: Boolean(bandToken) || hasLegibilityEffect(lowerThird.effect),
  };
}
