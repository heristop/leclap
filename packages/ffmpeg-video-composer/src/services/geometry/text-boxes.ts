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

// caption.text is a TranslationSchema (locale map) for every schema-valid template. The bare-string
// branch stays for callers that hand collectBoxes unvalidated input directly.
function captionText(caption: { text?: unknown }): string {
  const text = caption.text;

  if (typeof text === 'string') {
    return text;
  }

  // TranslationSchema: a locale map. The longest string is the one that will overflow first.
  if (text && typeof text === 'object') {
    const values = Object.values(text as Record<string, unknown>).filter((v): v is string => typeof v === 'string');

    return values.sort((a, b) => b.length - a.length)[0] ?? '';
  }

  return '';
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
}

function sectionDuration(section: { options?: { duration?: number } }): number {
  return section.options?.duration ?? ASSUMED_DURATION_SEC;
}

// Everything boxForSection needs about where a section sits on the timeline and canvas, bundled so
// the function stays under the lint's max-params limit.
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
    label: `Section "${section.name}" caption`,
    x: horizontalOrigin(caption.align, width, canvas),
    y: canvas.height * (VERTICAL_ANCHORS[caption.position ?? 'lower-third'] ?? 0.72),
    width,
    height,
    startSec,
    endSec: startSec + duration,
    approx: metrics === null,
  };
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
    const box = boxForSection(section, { index, startSec: cursorSec, duration, canvas, resolve });

    if (box) {
      boxes.push(box);
    }

    cursorSec += duration;
  }

  return boxes;
}
