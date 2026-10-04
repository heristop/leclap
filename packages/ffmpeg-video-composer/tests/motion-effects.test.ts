import { describe, expect, it } from 'vitest';
import { designedTransitionGraph, DESIGNED_TRANSITIONS, isDesignedTransition } from '@/core/motion/transitions';
import { cameraFilters } from '@/core/motion/camera';
import { graphicToFilters } from '@/editor/presets/graphics';
import { buildNormalizeGraph, buildVideoGraph } from '@/editor/utils/transition-graph';
import { CameraSchema } from '@/schemas/camera.schemas';
import { GraphicSchema } from '@/schemas/graphics.schemas';
import { TemplateValidator } from '@/services/TemplateValidator';
import { evaluateExpr } from '@/services/geometry/drawtext-expr';

const FRAME = { width: 1280, height: 720, fps: 30, duration: 3, seed: 9 };

function option(fragment: string, key: string): string {
  return new RegExp(`${key}='([^']*)'`).exec(fragment)?.[1] ?? '';
}

describe('designed transitions', () => {
  const boundary = {
    left: 'vs0',
    right: 'vs1',
    out: 'v0',
    id: 'dt0',
    offset: 2,
    duration: 0.6,
    width: 1280,
    height: 720,
    fps: 30,
  };

  it('cuts head/tail/in/rest on the xfade timeline and concatenates them back', () => {
    const graph = designedTransitionGraph({ ...boundary, type: 'push-left' });

    expect(graph).toContain('[vs0]split=2[dt0l1][dt0l2]');
    expect(graph).toContain('[dt0l1]trim=end=2,setpts=PTS-STARTPTS[dt0head]');
    expect(graph).toContain('[dt0l2]trim=start=2:end=2.6,setpts=PTS-STARTPTS[dt0tail]');
    expect(graph).toContain('[dt0r2]trim=start=0.6,setpts=PTS-STARTPTS[dt0rest]');
    expect(graph).toMatch(/\[dt0head\]\[dt0mix\]\[dt0rest\]concat=n=3:v=1:a=0,settb=AVTB\[v0\]$/);
  });

  it('push slides by exactly one frame width over the transition, on the eased curve', () => {
    const x = option(designedTransitionGraph({ ...boundary, type: 'push-left' }), 'x');

    expect(evaluateExpr(x, { t: 0 })).toBe(0);
    expect(evaluateExpr(x, { t: 0.3 })).toBeCloseTo(640, 0);
    expect(evaluateExpr(x, { t: 0.6 })).toBe(1280);
  });

  it('springs overshoot a push', () => {
    const x = option(designedTransitionGraph({ ...boundary, type: 'push-left', ease: 'spring(300, 14)' }), 'x');
    const peak = Math.max(...Array.from({ length: 61 }, (_, i) => evaluateExpr(x, { t: i * 0.01 }) as number));

    expect(peak).toBeGreaterThan(1280);
  });

  it('lowers every designed type with per-frame filters only (no per-pixel expressions)', () => {
    for (const type of DESIGNED_TRANSITIONS) {
      const graph = designedTransitionGraph({ ...boundary, type });

      expect(graph, type).not.toContain('transition=custom');
      expect(isDesignedTransition(type)).toBe(true);
    }
  });

  it('keeps built-in boundaries and the normalize graph byte-identical', () => {
    expect(
      buildVideoGraph([{ type: 'fade', duration: 0.5 }], [2.5], [0.5], '[vout]', { scale: '1280:720', fps: 30 })
    ).toBe('[vs0][vs1]xfade=transition=fade:duration=0.5:offset=2.5[vout]');
    expect(buildNormalizeGraph(1, '1280:720')).not.toContain('settb');
    expect(buildNormalizeGraph(1, '1280:720', true)).toContain('setsar=1,settb=AVTB[vs0]');
  });
});

describe('camera', () => {
  function zoomAt(filters: string[], on: number): number | null {
    const zoompan = filters.find((f) => f.startsWith('zoompan')) ?? '';

    return evaluateExpr(option(zoompan, 'z'), { on });
  }

  it('does nothing without a move', () => {
    expect(cameraFilters(undefined, FRAME)).toEqual([]);
    expect(cameraFilters(CameraSchema.parse({ preset: 'none' }), FRAME)).toEqual([]);
  });

  it('push-in dollies from framed to closer over the section, on the frame clock', () => {
    const filters = cameraFilters(CameraSchema.parse({ preset: 'push-in', amount: 0.2 }), FRAME);

    expect(filters[0]).toBe('scale=2560:1440');
    expect(zoomAt(filters, 0)).toBeCloseTo(1, 6);
    expect(zoomAt(filters, 90)).toBeCloseTo(1.2, 3);
  });

  it('hits punch in and relax', () => {
    const filters = cameraFilters(CameraSchema.parse({ hits: [{ at: 1, strength: 0.1, decay: 10 }] }), FRAME);

    expect(zoomAt(filters, 29)).toBeCloseTo(1, 6);
    expect(zoomAt(filters, 30)).toBeCloseTo(1.1, 6);
    expect(zoomAt(filters, 60)).toBeLessThan(1.001);
  });

  it('handheld shake is seeded: same seed, same path; new seed, new path', () => {
    const camera = CameraSchema.parse({ preset: 'handheld', shake: { rotation: 1 } });
    const a = cameraFilters(camera, FRAME);

    expect(cameraFilters(camera, FRAME)).toEqual(a);
    expect(cameraFilters(camera, { ...FRAME, seed: 10 })).not.toEqual(a);
    expect(a.some((f) => f.startsWith('rotate='))).toBe(true);
    // Overscan keeps the roll and wander inside the frame.
    expect(zoomAt(a, 0)).toBeGreaterThan(1.01);
  });
});

describe('graphics', () => {
  const frame = { width: 1280, height: 720, fps: 30 };

  function boxes(spec: unknown) {
    return graphicToFilters(GraphicSchema.parse(spec), frame).map((f) => f.values as Record<string, string>);
  }

  it('flash decays per frame and leaves nothing behind', () => {
    const flash = boxes({ type: 'flash', at: 1, duration: 0.2, intensity: 0.8 });
    const alphas = flash.map((b) => Number(b.color.split('@')[1]));

    expect(flash).toHaveLength(6);
    expect(alphas[0]).toBeGreaterThan(alphas[4]);
    expect(alphas.at(-1)).toBe(0);
    expect(flash[0].enable).toBe("'gte(t,1)*lt(t,1.033333)'");
  });

  it('bars slide in and hold, framing the cinema aspect', () => {
    const bars = boxes({ type: 'bars', aspect: 2.4, duration: 0.5 });
    const held = bars.slice(-2);

    expect(held.map((b) => b.h)).toEqual(['93.333333', '93.333333']);
    expect(held[0].enable).toBe("'gte(t,0.5)'");
  });

  it('underline grows from its origin and never emits an empty box', () => {
    const line = boxes({ type: 'underline', x: 100, y: 400, width: 400, origin: 'center', duration: 0.1 });

    expect(line.every((b) => Number(b.w) >= 1)).toBe(true);
    expect(line.at(-1)).toMatchObject({ x: '100', w: '400' });
  });

  it('honours until', () => {
    const panel = boxes({ type: 'panel', duration: 0.1, until: 2 });

    expect(panel.at(-1)?.enable).toBe("'gte(t,0.1)*lt(t,2)'");
  });
});

describe('effects validation', () => {
  const validator = new TemplateValidator();

  function codes(descriptor: unknown): string[] {
    return (validator.validateTemplate(descriptor).errors ?? []).map((error) => error.code);
  }

  const section = (extra: Record<string, unknown>) => ({
    name: 's',
    type: 'color_background',
    options: { backgroundColor: '#000000', duration: 3 },
    ...extra,
  });

  it('needs motionVersion 2 for camera, graphics and designed transitions', () => {
    expect(codes({ sections: [section({ camera: { preset: 'push-in' } })] })).toEqual(['motion_v2_required']);
    expect(codes({ sections: [section({ graphics: [{ type: 'flash' }] })] })).toEqual(['motion_v2_required']);
    expect(codes({ sections: [section({ transition: { type: 'push-left' } }), section({ name: 't' })] })).toEqual([
      'motion_v2_required',
    ]);
    expect(
      codes({
        meta: { motionVersion: 2 },
        sections: [
          section({ camera: { preset: 'push-in' }, transition: { type: 'push-left' } }),
          section({ name: 't' }),
        ],
      })
    ).toEqual([]);
  });
});
