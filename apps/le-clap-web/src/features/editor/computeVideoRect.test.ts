import { describe, it, expect } from 'vitest';
import { computeVideoRect, FULL_CROP } from '@/features/editor/useVideoEditor';

describe('computeVideoRect', () => {
  it('letterboxes a landscape source in a portrait container (bars top/bottom)', () => {
    const rect = computeVideoRect({ width: 400, height: 800 }, 1920, 1080);

    expect(rect.left).toBe(0);
    expect(rect.width).toBe(400);
    expect(rect.height).toBeCloseTo(225); // 400 / (16/9)
    expect(rect.top).toBeCloseTo((800 - 225) / 2);
  });

  it('pillarboxes a portrait source in a landscape container (bars left/right)', () => {
    const rect = computeVideoRect({ width: 800, height: 400 }, 1080, 1920);

    expect(rect.top).toBe(0);
    expect(rect.height).toBe(400);
    expect(rect.width).toBeCloseTo(225); // 400 * (9/16)
    expect(rect.left).toBeCloseTo((800 - 225) / 2);
  });

  it('fills the container when aspect ratios match', () => {
    expect(computeVideoRect({ width: 1600, height: 900 }, 1920, 1080)).toEqual({
      left: 0,
      top: 0,
      width: 1600,
      height: 900,
    });
  });

  it('returns the full container when sizes are unknown', () => {
    expect(computeVideoRect({ width: 0, height: 0 }, 1920, 1080)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(computeVideoRect({ width: 100, height: 100 }, 0, 0)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

describe('FULL_CROP', () => {
  it('represents the entire frame', () => {
    expect(FULL_CROP).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
