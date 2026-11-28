import { beforeAll, describe, expect, it } from 'vitest';
import { FX_PRIMITIVES, FxGraphicSchema } from '@/schemas/fx.schemas';
import { mirrorPlan } from '@/editor/presets/fx-mirror';
import type { FxContext } from '@/editor/presets/fx-kit';
import { hasFfmpeg, lowerGraphic, lumaAt, renderFrames, type Lowered } from './fixtures/fx-test-kit';
import { testBuildDir } from './fixtures/build-dir';

// fx "mirror": one side of the target reflected across a seam (or both axes, a kaleidoscope), held for the
// effect's duration. Built from crop + hflip/vflip + overlay (hstack/vstack are not in the device build).

const fx = (graphic: Record<string, unknown> = {}, options = {}): Lowered =>
  lowerGraphic({ effect: 'mirror', duration: 2, ...graphic }, options);

describe('fx mirror', () => {
  it('is a registered primitive with validated fields', () => {
    expect(FX_PRIMITIVES.mirror).toBeDefined();
    expect(
      FxGraphicSchema.safeParse({ type: 'fx', effect: 'mirror', mode: 'quad', side: 'end', seam: 0.4 }).success
    ).toBe(true);
    expect(FxGraphicSchema.safeParse({ type: 'fx', effect: 'mirror', mode: 'diagonal' }).success).toBe(false);
    expect(FxGraphicSchema.safeParse({ type: 'fx', effect: 'mirror', seam: 0.95 }).success).toBe(false);
  });

  it('reflects the left half onto the right across the centre by default on a wide target', () => {
    const { text } = fx();

    expect(text).toContain('[fx0_tap]trim=start=0.3,split=2[fx0_ma][fx0_mb]');
    expect(text).toContain('[fx0_mb]crop=640:720:0:0,hflip[fx0_mf]');
    expect(text).toContain('[fx0_ma][fx0_mf]overlay=x=640:y=0');
  });

  it('reflects the right side onto the left, and moves the seam', () => {
    expect(fx({ side: 'end' }).text).toContain('crop=640:720:640:0,hflip[fx0_mf]');
    expect(fx({ side: 'end' }).text).toContain('overlay=x=0:y=0');

    // Seam at 30 %: the axis sits at x=384 and the reflection reaches as far as the kept side (384 px).
    const left = fx({ seam: 0.3 }).text;

    expect(left).toContain('crop=384:720:0:0,hflip');
    expect(left).toContain('overlay=x=384:y=0');
  });

  it('mirrors top onto bottom vertically, and defaults to vertical on a tall target', () => {
    expect(fx({ mode: 'vertical' }).text).toContain('crop=1280:360:0:0,vflip[fx0_mf]');
    expect(fx({ mode: 'vertical' }).text).toContain('overlay=x=0:y=360');
    expect(fx({ target: { x: 0, y: 0, w: 400, h: 700 } }).text).toContain('vflip');
  });

  it('exposes its plan: the strip it keeps and where its reflection lands, per axis', () => {
    const target = { x: 100, y: 50, w: 600, h: 400, radius: 0, mask: 'none' };
    const ctx = (graphic: Record<string, unknown>) => ({ target, graphic }) as unknown as FxContext<'mirror'>;

    expect(mirrorPlan(ctx({}))).toEqual([{ axis: 'x', seam: 300, reach: 300, strip: 0, place: 300 }]);
    expect(mirrorPlan(ctx({ mode: 'quad', side: 'end', seam: 0.4 }))).toEqual([
      { axis: 'x', seam: 240, reach: 240, strip: 240, place: 0 },
      { axis: 'y', seam: 160, reach: 160, strip: 160, place: 0 },
    ]);
  });

  it('chains both axes into a kaleidoscope', () => {
    const { text } = fx({ mode: 'quad' });

    expect(text).toContain('crop=640:720:0:0,hflip');
    expect(text).toContain('crop=1280:360:0:0,vflip');
  });

  it('holds still under reduced motion and skips without hflip or vflip', () => {
    expect(fx({}, { energy: 0 }).text).toContain('hflip');

    const missing = fx({}, { has: (f: string) => f !== 'hflip' });

    expect(missing.filters).toEqual([]);
    expect(missing.warnings.join()).toContain('fx_skipped');
  });
});

describe.skipIf(!hasFfmpeg())('fx mirror render', () => {
  const W = 640;
  const H = 360;
  // A white bar on the left quarter: mirrored, it must appear on the right quarter too.
  const BAR = `color=c=black:s=${W}x${H}:r=30:d=1,drawbox=x=40:y=0:w=60:h=${H}:color=white:t=fill`;
  const SPEC = { base: BAR, width: W, height: H, seconds: 1, dir: testBuildDir('fx-mirror'), name: 'bar' };
  let frames: Buffer[] = [];

  beforeAll(() => {
    frames = renderFrames(SPEC, fx({ duration: 0.5 }, { scale: `${W}:${H}`, at: 0.2 }));
  }, 60000);

  it('shows the reflection only inside the window', () => {
    const reflected = (frame: Buffer): number => lumaAt(frame, W, W - 70, H / 2);

    expect(reflected(frames[2])).toBe(16);
    expect(reflected(frames[12])).toBeGreaterThan(200);
    expect(reflected(frames[27])).toBe(16);
  });
});
