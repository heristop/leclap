import { findFont, DEFAULT_FONT_ID } from '@/core/fonts';
import { parseFontMetrics, type FontMetrics } from '@/core/font-metrics';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import { canvasFor, collectBoxes } from './text-boxes';
import { collisionWarnings, legibilityWarnings, overflowWarnings, type GeometryWarning } from './rules';

export type { GeometryWarning } from './rules';
export type { Box, Canvas } from './text-boxes';

// Supplied by the caller, because this module must stay free of filesystem and network access: it
// is imported by TemplateValidator, whose import graph reaches the browser build, the React-Native
// build, and the web app. Returning null means "not available here" and is expected, not an error.
export type FontLoader = (fontFile: string) => Promise<Uint8Array | null>;

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

// Every distinct font the template's captions reference, defaulted where unset.
function referencedFontIds(template: TemplateDescriptor): string[] {
  const ids = (template.sections ?? [])
    .filter((section) => section.caption)
    .map((section) => section.caption?.font ?? DEFAULT_FONT_ID);

  return [...new Set(ids)];
}

// Load and parse each font once. A loader that returns null, yields bytes that will not parse, or
// throws outright all land in the same place: no metrics for that id, so its boxes fall back to the
// approximation and every warning drawn from them is flagged `approx`. Validation is advisory and
// must never be the thing that fails.
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

  const parsed = await Promise.all(entries.map((entry) => parseOne(loadFont, entry.file)));

  for (const [index, entry] of entries.entries()) {
    const metrics = parsed[index];

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
  const boxes = collectBoxes(template, (font) => metrics.get(font ?? DEFAULT_FONT_ID) ?? null);

  return [...overflowWarnings(boxes, canvas), ...legibilityWarnings(boxes, canvas), ...collisionWarnings(boxes)].slice(
    0,
    MAX_WARNINGS
  );
}
