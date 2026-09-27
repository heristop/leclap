import { describe, it, expect } from 'vitest';
import { measureRenderedContrast, type RgbFrame } from '@/services/geometry/pixel-contrast';

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function frame(width: number, height: number, fill: Rgb): RgbFrame {
  const data = new Uint8Array(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    data.set(fill, i * 3);
  }

  return { width, height, data };
}

function paint(target: RgbFrame, x: number, y: number, size: [number, number], color: Rgb): RgbFrame {
  const copy = { ...target, data: target.data.slice() };

  for (let row = y; row < y + size[1]; row++) {
    for (let col = x; col < x + size[0]; col++) {
      copy.data.set(color, (row * target.width + col) * 3);
    }
  }

  return copy;
}

// A 40x40 frame holding one 10x20 "glyph" at (15,10). `real` is the frame as rendered; `probe` is the
// same frame with only the glyph's fill swapped for a colour far from it — what render-check produces.
function pair(backdrop: RgbFrame, glyph: Rgb, probeGlyph: Rgb = glyph[0] > 127 ? BLACK : WHITE) {
  return {
    real: paint(backdrop, 15, 10, [10, 20], glyph),
    probe: paint(backdrop, 15, 10, [10, 20], probeGlyph),
  };
}

const WHOLE = { x: 0, y: 0, width: 40, height: 40 };

describe('measureRenderedContrast', () => {
  it('scores white text on black at the WCAG maximum', () => {
    const { real, probe } = pair(frame(40, 40, BLACK), WHITE);

    expect(measureRenderedContrast(real, probe, WHOLE)?.ratio).toBeCloseTo(21, 1);
  });

  it('scores near-white text on white as unreadable', () => {
    const { real, probe } = pair(frame(40, 40, WHITE), [238, 238, 238]);
    const measured = measureRenderedContrast(real, probe, WHOLE);

    expect(measured?.ratio).toBeLessThan(1.2);
    expect(measured?.text).toEqual({ r: 238, g: 238, b: 238 });
    expect(measured?.backdrop).toEqual({ r: 255, g: 255, b: 255 });
  });

  // Text the same colour as what it sits on vanishes from the real frame, so the glyph can only be
  // found through the probe — and it must come back as 1:1, not as "no text here".
  it('finds text drawn in the backdrop colour and scores it 1:1', () => {
    const { real, probe } = pair(frame(40, 40, WHITE), WHITE);

    expect(measureRenderedContrast(real, probe, WHOLE)?.ratio).toBeCloseTo(1, 5);
  });

  it('returns null when the probe changes nothing inside the box', () => {
    const blank = frame(40, 40, BLACK);

    expect(measureRenderedContrast(blank, blank, WHOLE)).toBeNull();
  });

  it('ignores glyphs outside the box it is asked about', () => {
    const { real, probe } = pair(frame(40, 40, BLACK), WHITE);

    expect(measureRenderedContrast(real, probe, { x: 30, y: 30, width: 10, height: 10 })).toBeNull();
  });

  // An outline is what a legibility aid looks like in pixels: a ring of its own colour hugging the
  // glyph. White text ringed in black stays readable on a white card.
  it('credits an outline drawn around the glyph', () => {
    const outlined = paint(frame(40, 40, WHITE), 12, 7, [16, 26], BLACK);
    const { real, probe } = pair(outlined, WHITE);

    expect(measureRenderedContrast(real, probe, WHOLE)?.ratio).toBeGreaterThan(15);
  });

  // Half the text over a dark band, half over a white one: most of the dark half reads, the white half
  // does not. The score is the lower quartile of the surroundings, so part-unreadable text fails.
  it('scores text straddling a light and a dark backdrop by its weaker side', () => {
    const split = paint(frame(40, 40, BLACK), 20, 0, [20, 40], WHITE);
    const { real, probe } = pair(split, WHITE);

    expect(measureRenderedContrast(real, probe, WHOLE)?.ratio).toBeLessThan(1.5);
  });

  it('clips a box that runs past the frame edge instead of reading out of bounds', () => {
    const { real, probe } = pair(frame(40, 40, BLACK), WHITE);

    expect(measureRenderedContrast(real, probe, { x: 10, y: -20, width: 100, height: 100 })?.ratio).toBeCloseTo(21, 1);
  });

  // Encoder noise is a few levels either way; it must not be mistaken for a glyph.
  it('treats small differences as noise, not text', () => {
    const base = frame(40, 40, [100, 100, 100]);
    const noisy = paint(base, 5, 5, [30, 30], [104, 103, 102]);

    expect(measureRenderedContrast(base, noisy, WHOLE)).toBeNull();
  });
});
