import { measureTextWidth, type FontMetrics } from '@/core/font-metrics';
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
  startSec: number;
  endSec: number;
  approx: boolean;
}

// A section's slot on the timeline, independent of whether it carries any text. `emptySectionWarnings`
// (rules.ts) reads these to flag a section that will render nothing, which a Box-only view cannot see
// since a textless section never produces a Box at all.
export interface SectionSpan {
  path: string;
  label: string;
  duration: number;
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

export function canvasFor(orientation: string | undefined): Canvas {
  return CANVASES[orientation ?? 'landscape'] ?? CANVASES.landscape;
}

// When a section declares no duration the engine derives one at render time from the clip. Two
// seconds is a neutral stand-in: it keeps later sections roughly ordered on the timeline so that
// temporal overlap stays meaningful, without pretending to know the real length.
const ASSUMED_DURATION_SEC = 2;

// Caption sizing when the descriptor does not override it. The engine derives this from the output
// height, so the same fraction is used here.
const DEFAULT_CAPTION_SIZE_RATIO = 0.055;

// Without real metrics, assume every glyph is 0.5em. That is close to typical Latin averages and
// slightly narrow, so an approximate box under-reports rather than crying wolf.
const ASSUMED_ADVANCE_EM = 0.5;

const VERTICAL_ANCHORS: Record<string, number> = {
  top: 0.08,
  center: 0.5,
  bottom: 0.86,
  'lower-third': 0.72,
};

// Layout constants mirrored from the lowerThird preset (editor/presets/text-blocks.ts): a translucent
// band anchored top or bottom, a left-margined title and subtitle inside it. Kept in sync by hand —
// this module cannot import the preset (it lowers to Filter[], not geometry) without pulling FFmpeg
// filter concerns into a pure measurement path.
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
// input directly.
function translationText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  // TranslationSchema: a locale map. The longest string is the one that will overflow first.
  if (value && typeof value === 'object') {
    const values = Object.values(value as Record<string, unknown>).filter((v): v is string => typeof v === 'string');

    return values.sort((a, b) => b.length - a.length)[0] ?? '';
  }

  return '';
}

function captionText(caption: { text?: unknown }): string {
  return translationText(caption.text);
}

function widthOf(text: string, fontSize: number, metrics: FontMetrics | null): number {
  if (!metrics) {
    return text.length * ASSUMED_ADVANCE_EM * fontSize;
  }

  return measureTextWidth(metrics, text, fontSize);
}

function horizontalOrigin(align: string | undefined, width: number, canvas: Canvas): number {
  if (align === 'left') {
    return canvas.width * 0.05;
  }

  if (align === 'right') {
    return canvas.width * 0.95 - width;
  }

  return (canvas.width - width) / 2;
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
    font?: string;
    fontsize?: number;
    align?: string;
    position?: string;
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
  resolve: (font: string | undefined) => FontMetrics | null;
}

// Builds the box for a single section's caption, or null when the section has no renderable text.
// Split out of collectBoxes to keep that function's statement count within the lint limit.
function boxForSection(section: CaptionedSection, placement: SectionPlacement): Box | null {
  const { index, startSec, duration, canvas, resolve } = placement;
  const caption = section.caption;

  if (!caption) {
    return null;
  }

  const text = captionText(caption);

  if (text === '') {
    return null;
  }

  const metrics = resolve(caption.font);
  const fontSize = caption.fontsize ?? canvas.height * DEFAULT_CAPTION_SIZE_RATIO;
  const width = widthOf(text, fontSize, metrics);
  const height = fontSize * 1.2;

  return {
    path: `sections[${index}].caption`,
    label: `Section "${sectionLabel(section, index)}" caption`,
    x: horizontalOrigin(caption.align, width, canvas),
    y: canvas.height * (VERTICAL_ANCHORS[caption.position ?? 'lower-third'] ?? 0.72),
    width,
    height,
    startSec,
    endSec: startSec + duration,
    approx: metrics === null,
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
  const text = translationText(lowerThird[spec.key]);

  if (text === '') {
    return null;
  }

  const { index, startSec, duration, canvas, resolve } = placement;
  const bandHeight = canvas.height * LOWER_THIRD_BAND_HEIGHT_RATIO;
  const bandY = lowerThird.position === 'top' ? 0 : canvas.height - bandHeight;
  const fontSize = canvas.height * spec.sizeRatio;
  const metrics = resolve(spec.font);
  const width = widthOf(text, fontSize, metrics);

  return {
    path: `sections[${index}].lowerThird.${spec.key}`,
    label: `Section "${sectionLabel(section, index)}" lower third ${spec.key}`,
    x: canvas.width * LOWER_THIRD_MARGIN_RATIO,
    y: bandY + canvas.height * spec.yRatio,
    width,
    height: fontSize * 1.2,
    startSec,
    endSec: startSec + duration,
    approx: metrics === null,
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

export function collectBoxes(
  template: TemplateDescriptor,
  resolve: (font: string | undefined) => FontMetrics | null
): Box[] {
  const canvas = canvasFor(template.global?.orientation);
  const boxes: Box[] = [];
  const sections = template.sections ?? [];
  let cursorSec = 0;

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    const duration = sectionDuration(section);
    const placement: SectionPlacement = { index, startSec: cursorSec, duration, canvas, resolve };
    const captionBox = boxForSection(section, placement);

    if (captionBox) {
      boxes.push(captionBox);
    }

    boxes.push(...lowerThirdBoxes(section, placement));

    // A negative or zero duration must not rewind the cursor: one bad section would otherwise shift
    // every later box's timeline, turning one `empty_section` finding into a cascade of bogus ones.
    cursorSec += Math.max(duration, 0);
  }

  return boxes;
}

// One entry per section regardless of whether it carries any text, so `emptySectionWarnings` can flag
// a zero/negative-duration section even when it has no caption or lowerThird to produce a Box.
export function collectSectionSpans(template: TemplateDescriptor): SectionSpan[] {
  const sections = template.sections ?? [];

  return sections.map((section, index) => ({
    path: `sections[${index}]`,
    label: `Section "${sectionLabel(section, index)}"`,
    duration: sectionDuration(section),
  }));
}
