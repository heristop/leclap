import { describe, expect, it } from 'vitest';
import { slateBands, slateWipeFrames } from './slate-wipe';

const VIEWPORT = { width: 1440, height: 900 };
const TOGGLE = { x: 1380, y: 40 };

describe('slate wipe', () => {
  it('lays stripes across the whole viewport, edge to edge', () => {
    const { bands, spacing } = slateBands(VIEWPORT, TOGGLE);

    expect(bands.length).toBeGreaterThan(8);
    for (let i = 1; i < bands.length; i++) expect(bands[i].center - bands[i - 1].center).toBeCloseTo(spacing);
  });

  it('opens the stripes nearest the toggle first', () => {
    const { bands } = slateBands(VIEWPORT, TOGGLE);
    const nearest = bands.reduce((a, b) => (a.delay < b.delay ? a : b));
    const farthest = bands.reduce((a, b) => (a.delay > b.delay ? a : b));

    expect(nearest.delay).toBe(0);
    expect(farthest.delay).toBeGreaterThan(0);
    expect(farthest.delay).toBeLessThan(1);
  });

  it('starts closed, ends with the stripes merged, and keeps one path shape for interpolation', () => {
    const frames = slateWipeFrames(VIEWPORT, TOGGLE, 24);
    const shape = (path: string) => path.replace(/-?\d+(\.\d+)?/g, '#');

    expect(frames).toHaveLength(24);
    expect(new Set(frames.map(shape)).size).toBe(1);
    expect(frames[0]).toMatch(/^path\('/);

    const { bands, spacing } = slateBands(VIEWPORT, TOGGLE);
    const widths = (frame: string) =>
      [...frame.matchAll(/M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) (-?[\d.]+)/g)].map((m) =>
        Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2]))
      );

    expect(widths(frames[0]).every((w) => w < 0.01)).toBe(true);
    expect(widths(frames.at(-1) ?? '').every((w) => w >= spacing)).toBe(true);
    expect(widths(frames.at(-1) ?? '')).toHaveLength(bands.length);
  });
});
