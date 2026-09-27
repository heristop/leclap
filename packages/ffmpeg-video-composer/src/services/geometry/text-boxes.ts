import DefaultConfig from '@/core/default.config';
import type { FontMetrics } from '@/core/font-metrics';
import {
  CAPTION_ALIGN_MARGIN,
  CAPTION_DEFAULT_ALIGN,
  CAPTION_DEFAULT_BOX_BORDER,
  captionAnchorY,
  captionStyleValues,
  type CaptionStyleValues,
} from '../../editor/presets/caption-layout';
import { resolveFontFile } from '../../editor/presets/text';
import { VIDEO_SEGMENT_TYPES } from '../../editor/utils/section-types';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import {
  LOWER_THIRD_BAND_HEIGHT_RATIO,
  LOWER_THIRD_LINES,
  LOWER_THIRD_MARGIN_RATIO,
  type LowerThirdLineSpec,
} from './lower-third-layout';
import {
  captionAppearance,
  captionBoxOpacity,
  lowerThirdAppearance,
  type AppearanceGlobal,
  type AppearanceSection,
  type TextEffectLike,
} from './text-appearance';
import { measure, type TextVariables } from './text-measure';

// The font file the renderer will ACTUALLY use, via the very helper captions.ts calls — not a second
// resolution rule. Re-deriving it here dropped `resolveFontFile`'s preset fallback, so an
// unrecognised `caption.font` ("Helvetica", or a typo'd registry id) yielded no metrics at all: the
// box fell back to the 0.5em-per-glyph estimate while the render used Oswald. The same caption was
// reported as "extends 218px past the frame edge" instead of "extends 55px past the title-safe
// margin". A `{{ var }}` font takes the same fallback: nothing substitutes variables into `fontfile`
// (FormatterManager.formatFont), so the render draws that caption in the preset face — and it is
// measured in it, rather than estimated at 0.5em and reported as overflowing by the difference.
export function captionFontFile(font: string | undefined, preset: CaptionStyleValues): string {
  return resolveFontFile(font, preset.fontfile);
}

// A positioned piece of text with the window during which it is on screen. Rules read these; nothing
// here judges anything.
export interface Box {
  path: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // The type size the engine will render at. Carried rather than recovered from `height`: `height`
  // also includes any background-box padding, so dividing it by the leading no longer gives the size
  // back — and the legibility rule reports that number to the author.
  fontSize: number;
  startSec: number;
  endSec: number;
  approx: boolean;
  // The effective text colour token, or `null` when missing/unreadable — never a guess.
  color: string | null;
  // What the text actually sits on: a box/band colour composited over the section background
  // when it carries alpha, the section's background when there is no box, or `null` when
  // genuinely unknowable (over footage, or behind an unparseable custom colour).
  backdrop: string | null;
  // Whether the author has already done something about legibility: a box/band, a shadow, or an
  // outline. The over-footage rule fires only when this is false.
  legibilityAid: boolean;
  // Whether `y` came from something the author chose (a caption's `position`) rather than from a
  // preset's fixed anchor (a lowerThird's band). The title-safe rule skips the vertical axis when
  // this is false, because a finding the author cannot act on is noise — see rules.ts.
  verticalPositionAuthored: boolean;
  // The side a left/right-aligned caption is pinned to by the preset's fixed CAPTION_ALIGN_MARGIN.
  // That edge sits the same distance from the frame whatever the text says — with the default box,
  // 80 − 18 = 62px, 2px past the landscape title-safe line — so the title-safe rule judges only the
  // side the text grows toward, the one "shorten it" can actually move.
  anchoredSide?: 'left' | 'right';
  // Whether this box's time window rests on ASSUMED_DURATION_SEC — its own section declared no
  // duration, or an earlier one did and shifted the cursor. Kept apart from `approx`, which is about
  // width: only the collision rule reads the timeline, so only it should be qualified by this.
  timingAssumed: boolean;
}

export interface Canvas {
  width: number;
  height: number;
}

// Read from the engine's own scale constants rather than re-typed here: a second copy of
// 1280x720/720x1280/1080x1080 is one edit away from laying text out on a frame the renderer does not
// use, which is the same drift `caption-layout.ts` was extracted to stop. Portrait is the landscape
// preset transposed — exactly what TemplateDirector does with `DefaultConfig.SCALE`.
function canvasFromScale(scale: string, transpose = false): Canvas {
  const [width, height] = scale.split(':').map(Number);

  return transpose ? { width: height, height: width } : { width, height };
}

const CANVASES: Record<string, Canvas> = {
  landscape: canvasFromScale(DefaultConfig.SCALE),
  portrait: canvasFromScale(DefaultConfig.SCALE, true),
  square: canvasFromScale(DefaultConfig.SQUARE_SCALE),
};

// `Object.hasOwn`, not `CANVASES[key] ?? fallback`: every plain object inherits truthy `toString`,
// `constructor` and `__proto__`, so `??` would never reach the fallback and `canvas.width` would be
// undefined — making every threshold NaN and every rule silently pass.
export function canvasFor(orientation: string | undefined): Canvas {
  const key = orientation ?? 'landscape';

  return Object.hasOwn(CANVASES, key) ? CANVASES[key] : CANVASES.landscape;
}

// When a section declares no duration the engine derives one at render time from the clip. Two
// seconds is a neutral stand-in: it keeps later sections roughly ordered on the timeline so that
// temporal overlap stays meaningful, without pretending to know the real length.
const ASSUMED_DURATION_SEC = 2;

// drawtext has no leading of its own; this is the box height the geometry model ascribes to one line
// of type at a given size. Carried on `Box.fontSize` too, so the rules never have to divide it back
// out to recover the size they want to report.
const LINE_HEIGHT = 1.2;

// Absolute pixel margins, mirroring captions.ts's ALIGN_X. Not a fraction of the frame: 80px is 6%
// of a landscape width and 11% of a portrait one, so a ratio is wrong in at least one orientation.
function horizontalOrigin(align: string | undefined, width: number, canvas: Canvas): number {
  const key = align ?? CAPTION_DEFAULT_ALIGN;

  if (key === 'left') {
    return CAPTION_ALIGN_MARGIN;
  }

  if (key === 'right') {
    return canvas.width - width - CAPTION_ALIGN_MARGIN;
  }

  return (canvas.width - width) / 2;
}

// Which side, if any, `horizontalOrigin` pins to the preset margin. See Box.anchoredSide.
function anchoredSide(align: string | undefined): Box['anchoredSide'] {
  const key = align ?? CAPTION_DEFAULT_ALIGN;

  return key === 'left' || key === 'right' ? key : undefined;
}

// Resolves captions.ts's drawtext expressions against a known box height. `top` is a fixed offset
// from the top edge; `bottom`/`lower-third` are offsets from the bottom edge of the drawn box; and
// `center` centres that box — `(h-text_h)/2`, not `h/2`, which is half a line lower.
function verticalOrigin(position: string | undefined, height: number, canvas: Canvas): number {
  const anchor = captionAnchorY(position);

  if (anchor.edge === 'top') {
    return anchor.offset;
  }

  if (anchor.edge === 'center') {
    return (canvas.height - height) / 2;
  }

  return canvas.height - height - anchor.offset;
}

// A section's name, or a positional fallback when it has none — so an unnamed section reads as
// `sections[2]` rather than the literal string "undefined".
function sectionLabel(section: { name?: string }, index: number): string {
  return section.name ?? `sections[${index}]`;
}

// Section shape is intentionally loose here: only the fields collectBoxes reads are named, so this
// helper works for every section variant without importing each one's specific schema type. The
// fields that decide what the text is drawn over come from AppearanceSection.
interface CaptionedSection extends AppearanceSection {
  name?: string;
  options?: AppearanceSection['options'] & {
    duration?: number;
    upperCase?: boolean;
    lowerCase?: boolean;
  };
  caption?: {
    text?: unknown;
    style?: string;
    font?: string;
    fontsize?: number;
    align?: string;
    position?: string;
    box?: boolean;
    color?: string;
    boxColor?: string;
    boxOpacity?: number;
    effect?: TextEffectLike;
  };
  lowerThird?: {
    title?: unknown;
    subtitle?: unknown;
    position?: string;
    bandColor?: string;
    boxOpacity?: number;
    effect?: TextEffectLike;
  };
}

// The template-wide settings a box depends on: `global.variables`, substituted into text before it is
// drawn, and the decorations that recolour every section (`look`/`grade`).
type TemplateGlobal = AppearanceGlobal & { variables?: TextVariables };

// `Number.isFinite`, not a bare `??`: `??` only covers null/undefined, and
// `Math.max(NaN, 0)` at the call site is NaN, so one `duration: "abc"` from unvalidated input made
// the cursor NaN and every later box's window with it. The finding read "overlaps … for NaNs", and
// because every NaN comparison is false the collision rule's `b.startSec >= a.endSec` early exit
// never fired either — silently restoring the O(n^2) sweep the break exists to avoid.
function declaredDuration(section: { options?: { duration?: number } }): number | null {
  const duration = section.options?.duration;

  return Number.isFinite(duration) ? (duration as number) : null;
}

// `caption`/`lowerThird` live on the BASE section schema, so a `form` or `music` section may carry
// one and still be schema-valid — but TemplateDirector renders only VIDEO_SEGMENT_TYPES, so no
// drawtext is ever emitted for them. Modelling those boxes sent authors to fix a caption that
// produces no filter at all, and let a `music` padding section advance the modelled cursor by
// seconds of output the render never contains.
export function isRenderableSection(section: CaptionedSection): boolean {
  return section.type !== undefined && VIDEO_SEGMENT_TYPES.has(section.type);
}

// Everything boxForSection/lowerThirdBoxes need about where a section sits on the timeline and canvas,
// bundled so those functions stay under the lint's max-params limit.
interface SectionPlacement {
  index: number;
  // Where the author edits this section: `sections[i]` in the descriptor as written, or — for a
  // section a partial supplied — the partial's own entry (`partials[p].sections[j]`, or the inline
  // `sections[i].sections[j]`). `index` is only the position in the expanded list. Every `path` is
  // built from this one; see `authoredPaths` in ./index.ts.
  authoredPath: string;
  startSec: number;
  duration: number;
  timingAssumed: boolean;
  canvas: Canvas;
  resolve: (font: string) => FontMetrics | null;
  global: TemplateGlobal | undefined;
}

// drawtext's background box pads the painted area by `boxborderw` on every side, so the rectangle on
// screen is wider and taller than the glyphs. It is on by default for the `bar` style — the schema
// default — which made the un-padded model under-report every default caption by 36px.
function boxPadding(caption: NonNullable<CaptionedSection['caption']>, preset: CaptionStyleValues): number {
  // Same predicate the appearance side uses: a `boxOpacity: 0` box paints nothing, so padding the
  // modelled rectangle by 36px for it invents a border that never reaches the frame.
  const boxOn = (caption.box ?? Boolean(preset.box)) && captionBoxOpacity(caption) > 0;

  return boxOn ? (preset.boxborderw ?? CAPTION_DEFAULT_BOX_BORDER) : 0;
}

// Builds the box for a single section's caption, or null when the section has no renderable text.
// Split out of collectBoxes to keep that function's statement count within the lint limit.
function boxForSection(section: CaptionedSection, placement: SectionPlacement): Box | null {
  const { index, authoredPath, startSec, duration, timingAssumed, canvas, resolve, global } = placement;
  const caption = section.caption;

  if (!caption) {
    return null;
  }

  // The style preset supplies the font file and the size when the caption overrides neither
  // (captions.ts's `resolveFontFile(caption.font, preset.fontfile)` / `caption.fontsize ??
  // preset.fontsize`). Both are absolute and orientation-independent.
  const preset = captionStyleValues(caption.style);
  const fontSize = caption.fontsize ?? preset.fontsize;
  const fontFile = captionFontFile(caption.font, preset);
  const measured = measure(caption.text, fontSize, resolve(fontFile), section.options, global?.variables);

  if (!measured) {
    return null;
  }

  // drawtext anchors the GLYPH box — `x`/`y` in captions.ts are `w-text_w-80` and `(h-text_h)-110`,
  // both in terms of text_w/text_h — and the background box then grows outward by `boxborderw` on
  // every side. Anchoring the padded rectangle instead would slide it 18px off the very edge it is
  // pinned to, in the direction the author is watching.
  const padding = boxPadding(caption, preset);
  const textWidth = measured.width;
  const textHeight = fontSize * LINE_HEIGHT * measured.lines;
  const appearance = captionAppearance(caption, preset, section, global);

  return {
    path: `${authoredPath}.caption`,
    label: `Section "${sectionLabel(section, index)}" caption`,
    x: horizontalOrigin(caption.align, textWidth, canvas) - padding,
    y: verticalOrigin(caption.position, textHeight, canvas) - padding,
    width: textWidth + padding * 2,
    height: textHeight + padding * 2,
    fontSize,
    startSec,
    endSec: startSec + duration,
    timingAssumed,
    approx: measured.approx,
    color: appearance.color,
    backdrop: appearance.backdrop,
    legibilityAid: appearance.legibilityAid,
    // `caption.position` is the author's, so both axes are theirs to fix.
    verticalPositionAuthored: true,
    anchoredSide: anchoredSide(caption.align),
  };
}

// Builds the box for one lowerThird line (title or subtitle), or null when that line has no text.
function lowerThirdLineBox(
  lowerThird: NonNullable<CaptionedSection['lowerThird']>,
  spec: LowerThirdLineSpec,
  section: CaptionedSection,
  placement: SectionPlacement
): Box | null {
  const { index, authoredPath, startSec, duration, timingAssumed, canvas, resolve, global } = placement;
  const fontSize = canvas.height * spec.sizeRatio;
  const measured = measure(lowerThird[spec.key], fontSize, resolve(spec.font), section.options, global?.variables);

  if (!measured) {
    return null;
  }

  const bandHeight = canvas.height * LOWER_THIRD_BAND_HEIGHT_RATIO;
  const bandY = lowerThird.position === 'top' ? 0 : canvas.height - bandHeight;
  const appearance = lowerThirdAppearance(lowerThird, section, global);

  return {
    path: `${authoredPath}.lowerThird.${spec.key}`,
    label: `Section "${sectionLabel(section, index)}" lower third ${spec.key}`,
    x: canvas.width * LOWER_THIRD_MARGIN_RATIO,
    y: bandY + canvas.height * spec.yRatio,
    width: measured.width,
    height: fontSize * LINE_HEIGHT * measured.lines,
    fontSize,
    startSec,
    endSec: startSec + duration,
    timingAssumed,
    approx: measured.approx,
    color: spec.color,
    backdrop: appearance.backdrop,
    legibilityAid: appearance.legibilityAid,
    // The band, and every line inside it, is pinned by the preset — only `position` (top/bottom) is
    // the author's, and neither choice clears the title-safe line. See rules.ts safeAreaExcess.
    verticalPositionAuthored: false,
  };
}

// A lowerThird's title and subtitle as separate boxes, on screen for the same window as the section's
// caption — the case that makes collision reachable at all (see rules.ts collisionWarnings).
function lowerThirdBoxes(section: CaptionedSection, placement: SectionPlacement): Box[] {
  const lowerThird = section.lowerThird;

  if (!lowerThird) {
    return [];
  }

  const boxes: Box[] = [];

  for (const spec of LOWER_THIRD_LINES) {
    const box = lowerThirdLineBox(lowerThird, spec, section, placement);

    if (box) {
      boxes.push(box);
    }
  }

  return boxes;
}

// The canvas is a parameter rather than re-derived here: `collectGeometryWarnings` already computed
// one to judge the boxes against, and two independent derivations from the same descriptor is one
// edit away from laying text out on one frame and measuring it against another.
// `origins[i]` is where the author edits expanded section `i` (see SectionPlacement.authoredPath).
// Every `path` is built from it. Defaults to `sections[i]` so a caller measuring an already-flat
// descriptor — or a test — need not supply one.
export function collectBoxes(
  template: TemplateDescriptor,
  canvas: Canvas,
  resolve: (font: string) => FontMetrics | null,
  origins?: string[]
): Box[] {
  const boxes: Box[] = [];
  // `Array.isArray`, not `?? []`: this function is exported and reached from the public
  // `getGeometryWarnings`, so a `sections: "nope"` throws `sections.length is not a function` out of
  // an advisory checker — and only when a font loader was supplied, since without one the metrics
  // pass returns early and the same input comes back silently clean. TemplateDirector guards the
  // identical case the same way.
  const sections: (CaptionedSection | null | undefined)[] = Array.isArray(template.sections) ? template.sections : [];
  let cursorSec = 0;
  let timingAssumed = false;

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];

    if (!section || !isRenderableSection(section)) {
      continue;
    }

    // A negative duration must not rewind the cursor, nor end a box before it starts. The schema
    // forbids one (`z.number().positive()`), so this is unreachable from a validated descriptor —
    // but `collectBoxes` is exported and may be handed unvalidated input, where one bad section
    // would shift every later box's window and turn a single mistake into a cascade of bogus
    // collision findings.
    const declared = declaredDuration(section);
    const duration = Math.max(declared ?? ASSUMED_DURATION_SEC, 0);
    // Sticky: once one window is a guess, every later start time is built on it.
    timingAssumed ||= declared === null;
    const placement: SectionPlacement = {
      index,
      authoredPath: origins?.[index] ?? `sections[${index}]`,
      startSec: cursorSec,
      duration,
      timingAssumed,
      canvas,
      resolve,
      global: template.global,
    };
    const captionBox = boxForSection(section, placement);

    if (captionBox) {
      boxes.push(captionBox);
    }

    boxes.push(...lowerThirdBoxes(section, placement));

    cursorSec += duration;
  }

  return boxes;
}
