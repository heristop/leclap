import { measureTextWidth, type FontMetrics } from '@/core/font-metrics';
import {
  CAPTION_ALIGN_MARGIN,
  CAPTION_DEFAULT_ALIGN,
  CAPTION_DEFAULT_BOX_BORDER,
  captionAnchorY,
  captionStyleValues,
  type CaptionStyleValues,
} from '@/editor/presets/caption-layout';
import type { TemplateDescriptor } from '../../schemas/template.schemas';

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
}

export interface Canvas {
  width: number;
  height: number;
}

const CANVASES: Record<string, Canvas> = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
  square: { width: 1080, height: 1080 },
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

// Without real metrics, assume every glyph is 0.5em — roughly the Latin average. It is not
// conservative in either direction (Rubik averages ~0.49em, Oswald ~0.37em), so an estimated box is
// a guess, not a bound. That is exactly why every finding drawn from one is flagged `approx`.
const ASSUMED_ADVANCE_EM = 0.5;

// drawtext has no leading of its own; this is the box height the geometry model ascribes to one line
// of type at a given size. Carried on `Box.fontSize` too, so the rules never have to divide it back
// out to recover the size they want to report.
const LINE_HEIGHT = 1.2;

// Layout constants mirrored from the lowerThird preset (editor/presets/text-blocks.ts): a translucent
// band anchored top or bottom, a left-margined title and subtitle inside it. Still transcribed by
// hand, unlike the caption numbers above, which now come from the shared `caption-layout.ts` — the
// lowerThird's are tangled up with the band/accent/badge filters and want the same extraction. Until
// then these six can drift, and there is no test that would notice. They match `text-blocks.ts` as
// of this writing; the badge line is absent here entirely and so is never measured.
const LOWER_THIRD_MARGIN_RATIO = 0.06;
const LOWER_THIRD_BAND_HEIGHT_RATIO = 0.2;
const LOWER_THIRD_TITLE_Y_RATIO = 0.055;
const LOWER_THIRD_TITLE_SIZE_RATIO = 0.05;
const LOWER_THIRD_SUBTITLE_Y_RATIO = 0.125;
const LOWER_THIRD_SUBTITLE_SIZE_RATIO = 0.028;
export const LOWER_THIRD_TITLE_FONT = 'Anton.ttf';
export const LOWER_THIRD_SUBTITLE_FONT = 'Oswald.ttf';

// caption.text (and lowerThird.title/subtitle) is a TranslationSchema (locale map) for every
// schema-valid template. The bare-string branch stays for callers that hand collectBoxes unvalidated
// input directly. Blank strings are dropped here rather than at the call site so the trim matches
// the engine's own `hasText` (editor/presets/text.ts) — a whitespace-only caption draws nothing, so
// modelling a box for it invents findings about text that never appears.
function localeCandidates(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value as Record<string, unknown>).filter(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  );
}

interface Measurement {
  width: number;
  approx: boolean;
}

// Code points, the same unit `measureTextWidth` iterates and drawtext advances by. `text.length`
// counts UTF-16 units instead, which doubles an NFD accent and reads one ZWJ family emoji as eleven
// characters — so the estimate and the measurement would disagree about the very same string for
// reasons that have nothing to do with the typeface.
function codePointCount(text: string): number {
  let count = 0;

  for (const _codePoint of text) {
    count++;
  }

  return count;
}

// A `{{ var }}` is substituted at render time, so a placeholder's width is a stand-in and never a
// fact — the same reason `fontFileFor` refuses to resolve a templated font id. Measuring it anyway
// beats silence, but the finding must not claim to be exact.
function isTemplated(text: string): boolean {
  return text.includes('{{');
}

// The widest locale wins, measured rather than counted: 24 "W"s render three times wider than 26
// "l"s, so picking the locale with the most UTF-16 code units drops real overflows and invents fake
// ones. Every locale is a candidate because any of them may be the one that ships.
function measure(value: unknown, fontSize: number, metrics: FontMetrics | null): Measurement | null {
  const candidates = localeCandidates(value);

  if (candidates.length === 0) {
    return null;
  }

  let width = 0;
  let approx = false;

  for (const text of candidates) {
    const exact = metrics && !isTemplated(text) ? measureTextWidth(metrics, text, fontSize) : null;
    const estimated = codePointCount(text) * ASSUMED_ADVANCE_EM * fontSize;

    approx = approx || exact === null;
    width = Math.max(width, exact ?? estimated);
  }

  return { width, approx };
}

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
// helper works for every section variant without importing each one's specific schema type.
interface CaptionedSection {
  name?: string;
  caption?: {
    text?: unknown;
    style?: string;
    font?: string;
    fontsize?: number;
    align?: string;
    position?: string;
    box?: boolean;
  };
  lowerThird?: {
    title?: unknown;
    subtitle?: unknown;
    position?: string;
  };
}

function sectionDuration(section: { options?: { duration?: number } }): number {
  return section.options?.duration ?? ASSUMED_DURATION_SEC;
}

// Everything boxForSection/lowerThirdBoxes need about where a section sits on the timeline and canvas,
// bundled so those functions stay under the lint's max-params limit.
interface SectionPlacement {
  index: number;
  startSec: number;
  duration: number;
  canvas: Canvas;
  resolve: (font: string) => FontMetrics | null;
}

// drawtext's background box pads the painted area by `boxborderw` on every side, so the rectangle on
// screen is wider and taller than the glyphs. It is on by default for the `bar` style — the schema
// default — which made the un-padded model under-report every default caption by 36px.
function boxPadding(caption: NonNullable<CaptionedSection['caption']>, preset: CaptionStyleValues): number {
  const boxOn = caption.box ?? Boolean(preset.box);

  return boxOn ? (preset.boxborderw ?? CAPTION_DEFAULT_BOX_BORDER) : 0;
}

// Builds the box for a single section's caption, or null when the section has no renderable text.
// Split out of collectBoxes to keep that function's statement count within the lint limit.
function boxForSection(section: CaptionedSection, placement: SectionPlacement): Box | null {
  const { index, startSec, duration, canvas, resolve } = placement;
  const caption = section.caption;

  if (!caption) {
    return null;
  }

  // The style preset supplies the font file and the size when the caption overrides neither
  // (captions.ts's `resolveFontFile(caption.font, preset.fontfile)` / `caption.fontsize ??
  // preset.fontsize`). Both are absolute and orientation-independent.
  const preset = captionStyleValues(caption.style);
  const fontSize = caption.fontsize ?? preset.fontsize;
  const measured = measure(caption.text, fontSize, resolve(caption.font ?? preset.fontfile));

  if (!measured) {
    return null;
  }

  // drawtext anchors the GLYPH box — `x`/`y` in captions.ts are `w-text_w-80` and `(h-text_h)-110`,
  // both in terms of text_w/text_h — and the background box then grows outward by `boxborderw` on
  // every side. Anchoring the padded rectangle instead would slide it 18px off the very edge it is
  // pinned to, in the direction the author is watching.
  const padding = boxPadding(caption, preset);
  const textWidth = measured.width;
  const textHeight = fontSize * LINE_HEIGHT;

  return {
    path: `sections[${index}].caption`,
    label: `Section "${sectionLabel(section, index)}" caption`,
    x: horizontalOrigin(caption.align, textWidth, canvas) - padding,
    y: verticalOrigin(caption.position, textHeight, canvas) - padding,
    width: textWidth + padding * 2,
    height: textHeight + padding * 2,
    fontSize,
    startSec,
    endSec: startSec + duration,
    approx: measured.approx,
  };
}

interface LowerThirdLineSpec {
  key: 'title' | 'subtitle';
  font: string;
  yRatio: number;
  sizeRatio: number;
}

const LOWER_THIRD_LINES: LowerThirdLineSpec[] = [
  {
    key: 'title',
    font: LOWER_THIRD_TITLE_FONT,
    yRatio: LOWER_THIRD_TITLE_Y_RATIO,
    sizeRatio: LOWER_THIRD_TITLE_SIZE_RATIO,
  },
  {
    key: 'subtitle',
    font: LOWER_THIRD_SUBTITLE_FONT,
    yRatio: LOWER_THIRD_SUBTITLE_Y_RATIO,
    sizeRatio: LOWER_THIRD_SUBTITLE_SIZE_RATIO,
  },
];

// Builds the box for one lowerThird line (title or subtitle), or null when that line has no text.
function lowerThirdLineBox(
  lowerThird: NonNullable<CaptionedSection['lowerThird']>,
  spec: LowerThirdLineSpec,
  section: CaptionedSection,
  placement: SectionPlacement
): Box | null {
  const { index, startSec, duration, canvas, resolve } = placement;
  const fontSize = canvas.height * spec.sizeRatio;
  const measured = measure(lowerThird[spec.key], fontSize, resolve(spec.font));

  if (!measured) {
    return null;
  }

  const bandHeight = canvas.height * LOWER_THIRD_BAND_HEIGHT_RATIO;
  const bandY = lowerThird.position === 'top' ? 0 : canvas.height - bandHeight;

  return {
    path: `sections[${index}].lowerThird.${spec.key}`,
    label: `Section "${sectionLabel(section, index)}" lower third ${spec.key}`,
    x: canvas.width * LOWER_THIRD_MARGIN_RATIO,
    y: bandY + canvas.height * spec.yRatio,
    width: measured.width,
    height: fontSize * LINE_HEIGHT,
    fontSize,
    startSec,
    endSec: startSec + duration,
    approx: measured.approx,
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
export function collectBoxes(
  template: TemplateDescriptor,
  canvas: Canvas,
  resolve: (font: string) => FontMetrics | null
): Box[] {
  const boxes: Box[] = [];
  const sections = template.sections ?? [];
  let cursorSec = 0;

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    // A negative duration must not rewind the cursor, nor end a box before it starts. The schema
    // forbids one (`z.number().positive()`), so this is unreachable from a validated descriptor —
    // but `collectBoxes` is exported and may be handed unvalidated input, where one bad section
    // would shift every later box's window and turn a single mistake into a cascade of bogus
    // collision findings.
    const duration = Math.max(sectionDuration(section), 0);
    const placement: SectionPlacement = { index, startSec: cursorSec, duration, canvas, resolve };
    const captionBox = boxForSection(section, placement);

    if (captionBox) {
      boxes.push(captionBox);
    }

    boxes.push(...lowerThirdBoxes(section, placement));

    cursorSec += duration;
  }

  return boxes;
}
