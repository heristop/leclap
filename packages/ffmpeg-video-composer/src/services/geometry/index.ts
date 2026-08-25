import { parseFontMetrics, type FontMetrics } from '@/core/font-metrics';
import { expandPartialsSafe } from '@/core/partials';
import { captionStyleValues } from '../../editor/presets/caption-layout';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import {
  canvasFor,
  captionFontFile,
  collectBoxes,
  isRenderableSection,
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
export { createBundledFontLoader, type FontLoader } from './bundled-font-loader';

// Past this, the report stops being read and starts being scrolled past. The first twenty findings
// are the ones worth acting on.
const MAX_WARNINGS = 20;

// Worst first, so the cut above keeps the findings worth acting on. Text off the frame edge is
// simply not on screen; a collision is two things fighting for one place; an overflow only risks a
// crop; the remaining three are legibility hints. Anything unranked sorts last rather than throwing
// the order away.
const SEVERITY_ORDER = [
  'text_out_of_frame',
  'text_collision',
  'text_overflow',
  'text_low_contrast',
  'text_too_small',
  'text_unreadable_over_footage',
];

function severityRank(warning: GeometryWarning): number {
  const rank = SEVERITY_ORDER.indexOf(warning.code);

  return rank === -1 ? SEVERITY_ORDER.length : rank;
}

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
  const all: LooseSection[] = Array.isArray(template.sections) ? template.sections : [];
  // The same gate `collectBoxes` applies. Without it the two walks disagreed about which sections
  // carry text, so a `form` or `music` section with a caption — schema-valid, but never lowered to a
  // drawtext filter — made the validator resolve, read and parse a ~350KB TTF whose metrics were
  // then never consulted.
  const sections = all.filter((section) => section && isRenderableSection(section));
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

// Which AUTHORED section each expanded section came from.
//
// `path` is what an MCP agent edits against, so it has to address the descriptor the author holds,
// not the one the model measured. Expansion splices a partial's sections inline, shifting every
// later index — a caption authored at `sections[1]` behind a three-section partial was reported at
// `sections[3]`, which is either the wrong section or none at all.
//
// Rebuilt through the public API rather than by threading provenance through `partials.ts`:
// expansion maps each authored section to 0..n expanded ones *in order*, so expanding one authored
// section at a time (against the same descriptor, so its `partials` registry still resolves) yields
// the counts. A caption a partial supplied resolves to the ref section that pulled it in, which is
// where the author has to go to change it.
function authoredOrigins(raw: TemplateDescriptor, expandedCount: number): number[] {
  const authored = Array.isArray(raw.sections) ? raw.sections : [];
  const origins: number[] = [];

  for (const [index, section] of authored.entries()) {
    const one = expandPartialsSafe({ ...raw, sections: [section] });
    const produced = one.ok ? ((one.data as TemplateDescriptor).sections?.length ?? 0) : 1;

    for (let k = 0; k < produced; k++) {
      origins.push(index);
    }
  }

  // A disagreement means the per-section walk and the whole-descriptor one diverged, which would
  // silently mis-address every finding. Identity is wrong in the same way the old code was, but it
  // is at least the failure everyone already reasons about.
  if (origins.length !== expandedCount) {
    return Array.from({ length: expandedCount }, (_, i) => i);
  }

  return origins;
}

export async function collectGeometryWarnings(
  raw: TemplateDescriptor,
  loadFont?: FontLoader
): Promise<GeometryWarning[]> {
  const template = expanded(raw);
  const canvas = canvasFor(template.global?.orientation);
  const metrics = await loadMetrics(template, loadFont);
  const origins = authoredOrigins(raw, Array.isArray(template.sections) ? template.sections.length : 0);
  const boxes = collectBoxes(template, canvas, (font) => metrics.get(font) ?? null, origins);

  const findings = [
    ...overflowWarnings(boxes, canvas),
    ...legibilityWarnings(boxes, canvas),
    ...contrastWarnings(boxes),
    ...footageLegibilityWarnings(boxes),
    // Capped at the whole budget, not at whatever the earlier rules left over. Handing collisions
    // the REMAINDER starved them: `text_unreadable_over_footage` fires once per unaided caption, so
    // 20 such sections filled the report and the sweep was called with a limit of 0 — its loop
    // condition false on entry, zero comparisons, every genuine overlap reported as clean. The cap
    // still stops the pairwise walk from running away; it just no longer depends on rule order.
    ...collisionWarnings(boxes, MAX_WARNINGS),
  ];

  // Ordered by severity before truncating, so which findings survive the cut is a property of the
  // findings rather than of the order the rules happen to run in. `sort` is stable, so each rule's
  // own ordering (and the timeline order `collectBoxes` emits) is preserved within a rank.
  return findings.sort((a, b) => severityRank(a) - severityRank(b)).slice(0, MAX_WARNINGS);
}
