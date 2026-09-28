// The pure half of the rendered check (render-check.ts runs FFmpeg): which text to look at and when,
// what to render, how to make the glyphs findable, and how a measured contrast refines the static
// findings. No FFmpeg, no filesystem, so all of it is unit-tested without a render.
import { parseColor, rgbToHex, type Rgb } from '@/core/color-contrast';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import { staticFindings, type MeasuredTemplate } from './index';
import type { PixelRect, RenderedContrast } from './pixel-contrast';
import { MIN_TEXT_CONTRAST, type GeometryWarning } from './rules';
import { isRenderableSection } from './text-boxes';
import type { Box } from './geometry-types';

// What sits behind the text is fixed by the template: one frame is the whole story.
const STILL_TYPES = new Set(['color_background', 'image_background']);

// Template footage is measurable, but one frame of it is only one frame. `project_video` is absent on
// purpose: it shows the user's own recording, which does not exist at validation time — the demo
// clip the engine would substitute is not what anyone will watch.
const MEASURABLE_TYPES = new Set([...STILL_TYPES, 'video']);

// The findings a measured contrast answers. Everything else (edges, collisions, size) is geometry the
// static model already reads exactly.
const SUPERSEDED_CODES = new Set(['text_low_contrast', 'text_unreadable_over_footage']);

export interface RenderTarget {
  box: Box;
  sectionName: string;
  sectionType: string;
  // Seconds into the section's own segment, where the text rests fully shown.
  offsetSec: number;
  // The box grown by a margin: the measured widths are font metrics, not drawtext's exact glyph bounds.
  rect: PixelRect;
  ringPx: number;
}

export interface RenderedResult {
  target: RenderTarget;
  // Null when no text was found there (hidden at that moment, covered, off frame): nothing to say.
  contrast: RenderedContrast | null;
}

function targetFor(box: Box, measured: MeasuredTemplate): RenderTarget | null {
  const entry = measured.lowered.find((lowered) => lowered.sectionIndex === box.sectionIndex);
  const name: unknown = entry?.section.name;
  const type: unknown = entry?.section.type;

  if (!entry || typeof name !== 'string' || typeof type !== 'string' || !MEASURABLE_TYPES.has(type)) {
    return null;
  }

  const pad = Math.max(4, Math.round(box.fontSize * 0.3));

  return {
    box,
    sectionName: name,
    sectionType: type,
    offsetSec: Math.max(0, box.settledSec - entry.startSec),
    rect: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 },
    ringPx: Math.max(2, Math.round(box.fontSize / 16)),
  };
}

export function renderTargets(measured: MeasuredTemplate): RenderTarget[] {
  return measured.boxes
    .map((box) => targetFor(box, measured))
    .filter((target): target is RenderTarget => target !== null);
}

type LooseSection = { name?: unknown; type?: string; transition?: unknown };

// Global keys only the final assembly reads.
const ASSEMBLY_ONLY = new Set(['transition', 'watermark', 'animations', 'audio']);

/**
 * The descriptor to render: only the sections holding text to measure, plus every section that never
 * renders (a `form` defines fields the others draw). What only the final assembly adds — music,
 * transitions, the whole-video watermark and animations, loudness normalisation — is dropped: none of
 * it is in a section's own segment, which is where the frames are read from.
 */
export function renderDescriptor(template: TemplateDescriptor, names: Set<string>): TemplateDescriptor {
  const global = Object.fromEntries(Object.entries(template.global ?? {}).filter(([key]) => !ASSEMBLY_ONLY.has(key)));
  const sections = ((template.sections ?? []) as unknown as LooseSection[])
    .filter((section) => !isRenderableSection(section) || names.has(section.name as string))
    .map(({ transition: _cut, ...section }) => section);

  return { ...template, global: { ...global, musicEnabled: false }, sections } as unknown as TemplateDescriptor;
}

// Text is single-quoted in the filtergraph (with its own quotes and colons escaped away), so matching
// a quoted run first and handing it back unchanged keeps a caption that says `fontcolor=` intact.
const FONTCOLOR = /'[^']*'|fontcolor=('[^']*'|[^:,"'\s;[\]]+)/g;

const MAGENTA = '#ff00ff';

// A fill far from the real one in at least one channel, opaque, so every glyph moves in the diff.
function probeColor(token: string): string {
  const paint = parseColor(token.replace(/^'|'$/g, ''));

  if (!paint) {
    return MAGENTA;
  }

  return Math.max(paint.rgb.r, paint.rgb.g, paint.rgb.b) >= 128 ? '#000000' : '#ffffff';
}

/** The same FFmpeg command with every drawtext fill swapped for a probe colour (see pixel-contrast.ts). */
export function probeTextFill(command: string): string {
  return command.replace(FONTCOLOR, (match: string, value: string | undefined) =>
    value === undefined ? match : `fontcolor='${probeColor(value)}'`
  );
}

function hex(color: Rgb): string {
  return rgbToHex(color);
}

function renderedWarning(target: RenderTarget, contrast: RenderedContrast): GeometryWarning {
  const { box, offsetSec, sectionType } = target;
  const frame = STILL_TYPES.has(sectionType) ? '' : ', in one frame of the footage';

  return {
    path: box.path,
    code: 'text_low_contrast_rendered',
    severity: 'warn',
    approx: false,
    message:
      `${box.label} renders at ${contrast.ratio.toFixed(1)}:1 against what surrounds it ` +
      `(${hex(contrast.text)} on ${hex(contrast.backdrop)}, ${offsetSec.toFixed(1)}s into the section${frame}), below ` +
      `${MIN_TEXT_CONTRAST}:1 — change the text colour, or add a box, outline or shadow`,
  };
}

// A path whose every box was measured over a fixed backdrop: its colour-token and over-footage
// findings are answered by pixels. A path any box of which went unmeasured — footage, a user
// recording, text the render could not find — keeps them.
function settledPaths(measured: MeasuredTemplate, results: RenderedResult[]): Set<string> {
  const settled = new Set(
    results.filter((r) => r.contrast && STILL_TYPES.has(r.target.sectionType)).map((r) => r.target.box)
  );
  const paths = new Set(measured.boxes.map((box) => box.path));

  for (const box of measured.boxes) {
    if (!settled.has(box)) {
      paths.delete(box.path);
    }
  }

  return paths;
}

/** The static findings, refined by what the render measured. Not yet de-duplicated or ordered. */
export function mergeRenderedFindings(measured: MeasuredTemplate, results: RenderedResult[]): GeometryWarning[] {
  const settled = settledPaths(measured, results);
  const kept = staticFindings(measured).filter(
    (finding) => !(SUPERSEDED_CODES.has(finding.code) && settled.has(finding.path))
  );
  const rendered = results
    .filter((r) => r.contrast !== null && r.contrast.ratio < MIN_TEXT_CONTRAST)
    .map((r) => renderedWarning(r.target, r.contrast as RenderedContrast));

  return [...kept, ...rendered];
}
