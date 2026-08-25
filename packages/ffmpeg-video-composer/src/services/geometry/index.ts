import { findFont } from '@/core/fonts';
import { parseFontMetrics, type FontMetrics } from '@/core/font-metrics';
import { captionStyleValues } from '@/editor/presets/caption-layout';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import { canvasFor, collectBoxes, LOWER_THIRD_TITLE_FONT, LOWER_THIRD_SUBTITLE_FONT } from './text-boxes';
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

// A descriptor's `font` is either a bundled font id ("rubik") or a raw ".ttf" filename. Anything
// carrying a `{{ var }}` is resolved at render time and cannot be measured now.
function fontFileFor(id: string): string | null {
  if (id.includes('{{')) {
    return null;
  }

  if (id.endsWith('.ttf')) {
    return id;
  }

  return findFont(id)?.file ?? null;
}

// Every distinct font the template's captions reference, plus the two fixed fonts the lowerThird
// preset always renders with. An unset `caption.font` defaults to the STYLE preset's file — Oswald
// for the default `bar`, BebasNeue for `bold` — not to the registry default: that is what
// `captionToFilters` does, and measuring a caption in a typeface the render will not use produces a
// confident wrong number. The lowerThird fonts are not descriptor-configurable, but resolving them
// keeps a lowerThird finding's `approx` marker honest.
function referencedFontIds(template: TemplateDescriptor): string[] {
  const sections = template.sections ?? [];
  const captionIds = sections
    .filter((section) => section.caption)
    .map((section) => section.caption?.font ?? captionStyleValues(section.caption?.style).fontfile);
  const lowerThirdIds = sections
    .filter((section) => section.lowerThird)
    .flatMap(() => [LOWER_THIRD_TITLE_FONT, LOWER_THIRD_SUBTITLE_FONT]);

  return [...new Set([...captionIds, ...lowerThirdIds])];
}

// Load and parse each font once. A loader that returns null, yields bytes that will not parse, or
// throws outright all land in the same place: no metrics for that id, so its boxes fall back to the
// approximation and every warning drawn from them is flagged `approx`. Validation is advisory and
// must never be the thing that fails.
//
// Deduplication happens on the FILE, not the id: `caption.font` accepts either a registry id or a
// raw filename ("rubik" and "Rubik.ttf" are both schema-valid and resolve to the same 351 KB file),
// so keying the I/O on the id would read and parse it twice for one typeface.
async function loadMetrics(
  template: TemplateDescriptor,
  loadFont: FontLoader | undefined
): Promise<Map<string, FontMetrics>> {
  const resolved = new Map<string, FontMetrics>();

  if (!loadFont) {
    return resolved;
  }

  const entries = referencedFontIds(template)
    .map((id) => ({ id, file: fontFileFor(id) }))
    .filter((entry): entry is { id: string; file: string } => entry.file !== null);

  const files = [...new Set(entries.map((entry) => entry.file))];
  const parsed = await Promise.all(files.map((file) => parseOne(loadFont, file)));
  const byFile = new Map(files.map((file, index) => [file, parsed[index]]));

  for (const entry of entries) {
    const metrics = byFile.get(entry.file);

    if (metrics) {
      resolved.set(entry.id, metrics);
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

export async function collectGeometryWarnings(
  template: TemplateDescriptor,
  loadFont?: FontLoader
): Promise<GeometryWarning[]> {
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
