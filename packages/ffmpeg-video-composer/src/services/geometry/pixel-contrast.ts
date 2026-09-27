// Contrast of text as it actually rendered, read from two frames of the same moment: `real`, as the
// template draws it, and `probe`, identical except that every glyph's fill was swapped for a colour
// far from its own (see render-check.ts). The pixels that differ ARE the glyphs — whatever colour the
// text is and whatever sits under it, white-on-white included, which a frame diffed against a
// text-free render would lose. Pure: raw rgb24 buffers in, a number out.
import { contrastRatio, type Rgb } from '@/core/color-contrast';

export interface RgbFrame {
  width: number;
  height: number;
  // Packed rgb24, row-major, no padding.
  data: Uint8Array;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedContrast {
  ratio: number;
  text: Rgb;
  backdrop: Rgb;
}

// A glyph swapped for a far-off colour moves at least one channel by well over this; encoder noise
// between two otherwise identical renders stays far below it.
const MIN_TEXT_DIFF = 48;

// Anti-aliased edges and faint noise sit between the two thresholds: excluded from the ring, but not
// sampled as the text colour either.
const COVERED_DIFF = 16;

// Too few glyph pixels to trust — a stray dot, not a line of text.
const MIN_GLYPH_PIXELS = 8;

// The score is the lower quartile of the surroundings, not their average: text that reads on most of
// its backdrop but vanishes over a quarter of it is text a viewer loses words of.
const RING_PERCENTILE = 0.25;

interface Bounds {
  x0: number;
  y0: number;
  width: number;
  height: number;
}

function clip(rect: PixelRect, frame: RgbFrame): Bounds | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(frame.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(frame.height, Math.ceil(rect.y + rect.height));

  return x1 > x0 && y1 > y0 ? { x0, y0, width: x1 - x0, height: y1 - y0 } : null;
}

// Byte offset in the frame of local pixel `i` of the bounds.
function offsetOf(i: number, bounds: Bounds, frame: RgbFrame): number {
  const row = bounds.y0 + Math.floor(i / bounds.width);
  const col = bounds.x0 + (i % bounds.width);

  return (row * frame.width + col) * 3;
}

function channelDiff(real: RgbFrame, probe: RgbFrame, offset: number): number {
  return Math.max(
    Math.abs(real.data[offset] - probe.data[offset]),
    Math.abs(real.data[offset + 1] - probe.data[offset + 1]),
    Math.abs(real.data[offset + 2] - probe.data[offset + 2])
  );
}

function diffMap(real: RgbFrame, probe: RgbFrame, bounds: Bounds): Uint8Array {
  const diffs = new Uint8Array(bounds.width * bounds.height);

  for (let i = 0; i < diffs.length; i++) {
    diffs[i] = channelDiff(real, probe, offsetOf(i, bounds, real));
  }

  return diffs;
}

function colorAt(frame: RgbFrame, offset: number): Rgb {
  return { r: frame.data[offset], g: frame.data[offset + 1], b: frame.data[offset + 2] };
}

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

// Per-channel median of the glyph's solid core: robust to the odd anti-aliased pixel that slips in.
function medianColor(colors: Rgb[]): Rgb {
  return { r: median(colors.map((c) => c.r)), g: median(colors.map((c) => c.g)), b: median(colors.map((c) => c.b)) };
}

// One pass of a separable max filter: marks every pixel within `radius` of a marked one along one axis.
function dilateAxis(mask: Uint8Array, bounds: Bounds, radius: number, horizontal: boolean): Uint8Array {
  const out = new Uint8Array(mask.length);
  const step = horizontal ? 1 : bounds.width;
  const span = horizontal ? bounds.width : bounds.height;

  for (let i = 0; i < mask.length; i++) {
    const at = horizontal ? i % bounds.width : Math.floor(i / bounds.width);
    const from = Math.max(0, at - radius);
    const to = Math.min(span - 1, at + radius);

    for (let k = from; k <= to && out[i] === 0; k++) {
      out[i] = mask[i + (k - at) * step];
    }
  }

  return out;
}

// What surrounds the glyphs: pixels within `radius` of one (Chebyshev), not themselves covered. An
// outline or a shadow lands here, and so gets credit for the legibility it buys; bare text gets
// scored against whatever the frame shows around it.
function ringIndices(covered: Uint8Array, bounds: Bounds, radius: number): number[] {
  const near = dilateAxis(dilateAxis(covered, bounds, radius, true), bounds, radius, false);
  const ring: number[] = [];

  for (let i = 0; i < near.length; i++) {
    if (near[i] === 1 && covered[i] === 0) {
      ring.push(i);
    }
  }

  return ring;
}

interface Glyphs {
  core: number[];
  covered: Uint8Array;
}

function findGlyphs(diffs: Uint8Array): Glyphs | null {
  const peak = diffs.reduce((max, value) => Math.max(max, value), 0);

  if (peak < MIN_TEXT_DIFF) {
    return null;
  }

  const coreFloor = Math.max(MIN_TEXT_DIFF, peak / 2);
  const core: number[] = [];
  const covered = diffs.map((value) => (value >= COVERED_DIFF ? 1 : 0));

  for (const [i, value] of diffs.entries()) {
    if (value >= coreFloor) {
      core.push(i);
    }
  }

  return core.length >= MIN_GLYPH_PIXELS ? { core, covered } : null;
}

/**
 * How the text inside `rect` reads against what surrounds it, or null when no text is found there
 * (off frame, hidden at that moment, covered). `ringPx` is how far around each glyph counts as its
 * surroundings — wide enough to take in an outline or a shadow offset.
 */
export function measureRenderedContrast(
  real: RgbFrame,
  probe: RgbFrame,
  rect: PixelRect,
  ringPx = 3
): RenderedContrast | null {
  const bounds = clip(rect, real);
  const glyphs = bounds ? findGlyphs(diffMap(real, probe, bounds)) : null;

  if (!bounds || !glyphs) {
    return null;
  }

  const ring = ringIndices(glyphs.covered, bounds, ringPx);

  if (ring.length === 0) {
    return null;
  }

  const text = medianColor(glyphs.core.map((i) => colorAt(real, offsetOf(i, bounds, real))));
  const scored = ring
    .map((i) => colorAt(real, offsetOf(i, bounds, real)))
    .map((color) => ({ color, ratio: contrastRatio(text, color) }))
    .sort((a, b) => a.ratio - b.ratio);
  const pick = scored[Math.floor((scored.length - 1) * RING_PERCENTILE)];

  return { ratio: pick.ratio, text, backdrop: pick.color };
}
