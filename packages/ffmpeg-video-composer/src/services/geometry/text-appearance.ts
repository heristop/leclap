// Colour/backdrop resolution for the geometry model's text boxes, split out of text-boxes.ts to
// keep that file under the max-lines budget. text-boxes.ts owns *where* text lands; this owns
// *what it's drawn on top of* — read by the contrast and over-footage rules in rules.ts.
import { compositeOver, parseColor, rgbToHex } from '@/core/color-contrast';
import {
  CAPTION_DEFAULT_BOX_COLOR,
  CAPTION_DEFAULT_BOX_OPACITY,
  type CaptionStyleValues,
} from '../../editor/presets/caption-layout';

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
    layers?: unknown[];
  };
}

// A `color_background` section's colour is a genuine backdrop; any other type may show footage or
// an image underneath, so the honest answer there is "unknown" rather than "none".
//
// `options.backgroundColor` lives on the BASE section schema, so a `project_video` can carry one
// too — it just does not describe what is behind the text there, because the clip is. Every caller
// must go through this gate: compositing a translucent caption box over a footage section's
// `backgroundColor` produced exactly the confident-and-wrong contrast number this module exists to
// avoid.
//
// `options.layers` composite ON TOP of the base colour and default to the full frame, so a single
// opaque layer hides `backgroundColor` completely. Reading the covered colour reported 21:1 for
// white-on-white. Whether a layer is opaque, and where it lands, is not modelled here — so the only
// honest answer once layers exist is "unknown".
function knownSectionBackground(section: AppearanceSection): string | null {
  if (section.type !== 'color_background' || (section.options?.layers?.length ?? 0) > 0) {
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

// Mirrors captions.ts's resolveBox: on when explicitly set or defaulted by the preset; an explicit
// override (or a preset with no box colour) builds a fresh token instead of reusing the preset's.
//
// `boxOpacity: 0` is schema-valid (`z.number().min(0)`) and paints nothing — drawtext still emits a
// `boxcolor` of `…@0`. Returning a truthy token for it made `legibilityAid` true, so the
// over-footage rule stayed silent about text with no visible background at all, while the very same
// caption written `box: false` was flagged. `lowerThirdBandToken` already guards this.
export function captionBoxOpacity(caption: CaptionAppearanceInput): number {
  return caption.boxOpacity ?? CAPTION_DEFAULT_BOX_OPACITY;
}

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
  section: AppearanceSection
): Appearance {
  const boxToken = captionBoxColorToken(caption, preset);
  const backdrop = boxToken
    ? resolveBackdrop(boxToken, knownSectionBackground(section))
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
    ? resolveBackdrop(bandToken, knownSectionBackground(section))
    : knownSectionBackground(section);

  return {
    backdrop,
    legibilityAid: Boolean(bandToken) || hasLegibilityEffect(lowerThird.effect),
  };
}
