import { describe, it, expect } from 'vitest';
import { cropRect } from './useCameraCapture';

// The recorder captures a canvas sized to cropRect's sw/sh. Android hardware H.264 encoders crash on
// odd dimensions, so the crop must always be even — this guards that invariant (plus center framing).
describe('cropRect', () => {
  it('returns even width and height (Android encoder requires even dims)', () => {
    const cases: Array<[number, number, number]> = [
      [1280, 720, 9 / 16], // landscape webcam, portrait template — width rounds to 405 → must be evened
      [720, 1280, 9 / 16], // native portrait stream
      [1281, 721, 9 / 16], // odd source dimensions
      [1920, 1080, 9 / 16],
      [640, 480, 9 / 16],
      [1280, 720, 1280 / 720], // landscape (no crop)
    ];

    for (const [w, h, aspect] of cases) {
      const { sw, sh } = cropRect(w, h, aspect);

      expect(sw % 2, `sw even for ${w}x${h}`).toBe(0);
      expect(sh % 2, `sh even for ${w}x${h}`).toBe(0);
      expect(sw).toBeGreaterThan(0);
      expect(sh).toBeGreaterThan(0);
    }
  });

  it('center-crops a landscape source to a 9:16 portrait region', () => {
    const { sx, sy, sw, sh } = cropRect(1280, 720, 9 / 16);

    expect(sh).toBe(720); // full height kept
    expect(sw).toBe(404); // 720 * 9/16 = 405 → evened down to 404
    expect(sy).toBe(0);
    expect(sx).toBe(Math.round((1280 - 404) / 2)); // horizontally centered
  });

  it('keeps a native portrait source effectively full-frame', () => {
    const { sx, sy, sw, sh } = cropRect(720, 1280, 9 / 16);

    expect(sw).toBe(720);
    expect(sh).toBe(1280);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });
});
