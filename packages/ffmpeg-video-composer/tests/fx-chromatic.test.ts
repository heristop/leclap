import { beforeAll, describe, expect, it } from 'vitest';
import { FX_PRIMITIVES, FxGraphicSchema } from '@/schemas/fx.schemas';
import { hasFfmpeg, lowerGraphic, lumaAt, renderFrames, type Lowered } from './fixtures/fx-test-kit';
import { testBuildDir } from './fixtures/build-dir';

// fx "chromatic": an RGB split that hits at the start of each pass and settles back to the clean picture.

const fx = (graphic: Record<string, unknown> = {}, options = {}): Lowered =>
  lowerGraphic({ effect: 'chromatic', duration: 0.5, ...graphic }, options);

interface Step {
  rh: number;
  rv: number;
  bh: number;
  bv: number;
  from: number;
  to: number;
}

function steps(text: string): Step[] {
  const pattern =
    /rgbashift=rh=(-?\d+):rv=(-?\d+):bh=(-?\d+):bv=(-?\d+):edge=smear:enable='between\(t,([\d.]+),([\d.]+)\)'/g;

  return [...text.matchAll(pattern)].map((m) => ({
    rh: Number(m[1]),
    rv: Number(m[2]),
    bh: Number(m[3]),
    bv: Number(m[4]),
    from: Number(m[5]),
    to: Number(m[6]),
  }));
}

describe('fx chromatic', () => {
  it('is a registered primitive with a validated shift', () => {
    expect(FX_PRIMITIVES.chromatic).toBeDefined();
    expect(FxGraphicSchema.safeParse({ type: 'fx', effect: 'chromatic', shift: 0.01, angle: 30 }).success).toBe(true);
    expect(FxGraphicSchema.safeParse({ type: 'fx', effect: 'chromatic', shift: 0.2 }).success).toBe(false);
  });

  it('splits red and blue in opposite directions from a tap of the picture, then settles to zero', () => {
    const { text } = fx({ shift: 0.01, angle: 0 });
    const runs = steps(text);

    expect(text).toContain('[fx0_tap]trim=start=0.3,rgbashift=');
    // 1 % of the 720 px short side: 7 px at the hit.
    expect(runs[0]).toMatchObject({ rh: -7, rv: 0, bh: 7, bv: 0 });
    expect(runs[0].from).toBeLessThan(0.3);

    for (const [i, run] of runs.entries()) {
      expect(run.bh, `step ${i}`).toBe(-run.rh);
      if (i > 0) expect(Math.abs(run.rh), `step ${i}`).toBeLessThanOrEqual(Math.abs(runs[i - 1].rh));
      if (i > 0) expect(run.from, `step ${i}`).toBeCloseTo(runs[i - 1].to, 5);
    }

    expect(runs.at(-1)!.to).toBeLessThanOrEqual(0.8);
    expect(runs.length).toBeGreaterThan(2);
  });

  it('follows the angle and scales with intensity', () => {
    expect(steps(fx({ shift: 0.01, angle: 90 }).text)[0]).toMatchObject({ rh: 0, rv: -7, bh: 0, bv: 7 });
    expect(steps(fx({ shift: 0.01, angle: 45 }).text)[0]).toMatchObject({ rh: -5, rv: -5, bh: 5, bv: 5 });
    expect(steps(fx({ shift: 0.01, angle: 0, intensity: 0.5 }).text)[0]).toMatchObject({ rh: -4, bh: 4 });
  });

  it('always shows at least a 1 px split at the hit on a small target', () => {
    const runs = steps(fx({ shift: 0.001, angle: 0, target: { x: 0, y: 0, w: 200, h: 100 } }).text);

    expect(runs[0]).toMatchObject({ rh: -1, bh: 1 });
  });

  it('jitters the split direction frame by frame when asked, deterministically', () => {
    const still = steps(fx({ shift: 0.02, angle: 0 }).text);
    const jittery = steps(fx({ shift: 0.02, angle: 0, jitter: 1 }).text);

    expect(still.every((run) => run.rv === 0)).toBe(true);
    expect(jittery.some((run) => run.rv !== 0)).toBe(true);
    expect(fx({ shift: 0.02, angle: 0, jitter: 1 }).text).toBe(fx({ shift: 0.02, angle: 0, jitter: 1 }).text);
    expect(FxGraphicSchema.safeParse({ type: 'fx', effect: 'chromatic', jitter: 2 }).success).toBe(false);
  });

  it('hits again on every pass', () => {
    const runs = steps(fx({ shift: 0.01, angle: 0, repeat: 2, every: 1 }).text);
    const hits = runs.filter((run) => Math.abs(run.rh) === 7);

    expect(hits).toHaveLength(2);
    expect(hits[1].from - hits[0].from).toBeCloseTo(1, 5);
  });

  it('derives its look from the seed when untuned', () => {
    const { text } = fx();

    expect(steps(text).length).toBeGreaterThan(0);
    expect(fx().text).toBe(text);
    expect(fx({}, { seed: 5 }).text).not.toBe(fx({}, { seed: 6 }).text);
  });

  it('is absent under reduced motion and skipped without rgbashift', () => {
    const reduced = fx({}, { energy: 0 });

    expect(reduced.filters).toEqual([]);
    expect(reduced.warnings).toEqual([]);

    const missing = fx({}, { has: (f: string) => f !== 'rgbashift' });

    expect(missing.filters).toEqual([]);
    expect(missing.warnings.join()).toContain('fx_skipped');
  });
});

describe.skipIf(!hasFfmpeg())('fx chromatic render', () => {
  const W = 640;
  const H = 360;
  // A white bar on black: the split shows as colour fringes, i.e. luma, just outside its edges.
  const BAR = `color=c=black:s=${W}x${H}:r=30:d=1,drawbox=x=300:y=0:w=40:h=${H}:color=white:t=fill`;
  const SPEC = { base: BAR, width: W, height: H, seconds: 1, dir: testBuildDir('fx-chromatic'), name: 'bar' };
  let frames: Buffer[] = [];

  beforeAll(() => {
    frames = renderFrames(SPEC, fx({ shift: 0.03, angle: 0 }, { scale: `${W}:${H}`, at: 0.2 }));
  }, 60000);

  it('fringes the bar at the hit and returns to the clean picture after the pass', () => {
    const outside = (frame: Buffer): number => lumaAt(frame, W, 296, H / 2);

    expect(outside(frames[3])).toBe(16);
    expect(outside(frames[7])).toBeGreaterThan(30);
    expect(outside(frames[28])).toBe(16);
  });
});
