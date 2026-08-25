import { parseFontMetrics, type FontMetrics } from '@/core/font-metrics';
import { expandPartialsSafe } from '@/core/partials';
import { captionStyleValues } from '../../editor/presets/caption-layout';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import {
  canvasFor,
  captionFontFile,
  collectBoxes,
  LOWER_THIRD_TITLE_FONT,
  LOWER_THIRD_SUBTITLE_FONT,
} from './text-boxes';
import {
  collisionWarnings,
  contrastWarnings,
  footageLegibilityWarnings,
  legibilityWarnings,
  overflowWarnings,
  type GeometryWarning,
} from './rules';
// FontLoader lives in bundled-font-loader.ts, not here, so this barrel only ever imports *from* that
// module — never the reverse — keeping the re-export of `createBundledFontLoader` below cycle-free.
import type { FontLoader } from './bundled-font-loader';

export type { GeometryWarning } from './rules';
export type { Box, Canvas } from './text-boxes';
export { createBundledFontLoader, type FontLoader } from './bundled-font-loader';

// Past this, the report stops being read and starts being scrolled past. The first twenty findings
// are the ones worth acting on.
const MAX_WARNINGS = 20;

// Every distinct font FILE the template's text will actually render with, plus the two fixed files
// the lowerThird preset always uses. Resolution goes through `captionFontFile`, which wraps the very
// helper captions.ts lowers with (`resolveFontFile`) — an unset `caption.font` therefore falls back
// to the STYLE preset's file (Oswald for the default `bar`, BebasNeue for `bold`), and so does an
// unrecognised one. Measuring a caption in a typeface the render will not use produces a confident
// wrong number; so does refusing to measure one the render resolves perfectly well.
//
// Keyed on the FILE, not the descriptor's `font` id: "rubik" and "Rubik.ttf" are both schema-valid
// and name the same 351 KB file, so keying on the id would read and parse it twice for one typeface.
function referencedFontFiles(template: TemplateDescriptor): string[] {
  // `Array.isArray`, like collectBoxes: this runs BEFORE the box pass, so a `sections: "nope"` threw
  // `sections.filter is not a function` out of an advisory checker — and only when a font loader was
  // supplied, since without one this whole function is skipped and the same input came back clean.
  type LooseSection = TemplateDescriptor['sections'] extends (infer S)[] | undefined ? S | null | undefined : never;
  const sections: LooseSection[] = Array.isArray(template.sections) ? template.sections : [];
  const captionFiles = sections
    .filter((section) => section?.caption)
    .map((section) => captionFontFile(section?.caption?.font, captionStyleValues(section?.caption?.style)));
  const lowerThirdFiles = sections
    .filter((section) => section?.lowerThird)
    .flatMap(() => [LOWER_THIRD_TITLE_FONT, LOWER_THIRD_SUBTITLE_FONT]);

  return [...new Set([...captionFiles, ...lowerThirdFiles])].filter((file): file is string => file !== null);
}

// Load and parse each font file once. A loader that returns null, yields bytes that will not parse,
// or throws outright all land in the same place: no metrics for that file, so its boxes fall back to
// the approximation and every warning drawn from them is flagged `approx`. Validation is advisory
// and must never be the thing that fails.
async function loadMetrics(
  template: TemplateDescriptor,
  loadFont: FontLoader | undefined
): Promise<Map<string, FontMetrics>> {
  const resolved = new Map<string, FontMetrics>();

  if (!loadFont) {
    return resolved;
  }

  const files = referencedFontFiles(template);
  const parsed = await Promise.all(files.map((file) => parseOne(loadFont, file)));

  for (const [index, file] of files.entries()) {
    const metrics = parsed[index];

    if (metrics) {
      resolved.set(file, metrics);
    }
  }

  return resolved;
}

async function parseOne(loadFont: FontLoader, file: string): Promise<FontMetrics | null> {
  try {
    const bytes = await loadFont(file);

    return bytes ? parseFontMetrics(bytes) : null;
  } catch {
    return null;
  }
}

// Partials are expanded here rather than left to the caller, for the same reason `validateTemplate`
// expands them: a `{ type: "partial", ref }` section carries no caption or lowerThird of its own, so
// measuring the raw descriptor reported a clean bill of health for everything the partial contains —
// and six of the nine bundled templates are partial-based. An unexpandable descriptor is measured
// as-is: this channel is advisory, and `validateTemplate` is what reports the broken ref.
function expanded(template: TemplateDescriptor): TemplateDescriptor {
  const expansion = expandPartialsSafe(template);

  return expansion.ok ? (expansion.data as TemplateDescriptor) : template;
}

export async function collectGeometryWarnings(
  raw: TemplateDescriptor,
  loadFont?: FontLoader
): Promise<GeometryWarning[]> {
  const template = expanded(raw);
  const canvas = canvasFor(template.global?.orientation);
  const metrics = await loadMetrics(template, loadFont);
  const boxes = collectBoxes(template, canvas, (font) => metrics.get(font) ?? null);

  const findings = [
    ...overflowWarnings(boxes, canvas),
    ...legibilityWarnings(boxes, canvas),
    ...contrastWarnings(boxes),
    ...footageLegibilityWarnings(boxes),
  ];

  // Collisions run last and are told how much of the budget is left, so a template that already
  // filled the report with overflow findings doesn't also pay for a full pairwise sweep whose
  // results are about to be sliced away.
  findings.push(...collisionWarnings(boxes, Math.max(MAX_WARNINGS - findings.length, 0)));

  return findings.slice(0, MAX_WARNINGS);
}
