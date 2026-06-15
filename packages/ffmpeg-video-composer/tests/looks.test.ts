import { describe, it, expect } from 'vitest';
import { lookToFilters, gradeToFilters, motionToFilters, layersToFilters } from '@/editor/presets/looks';
import type { Filter } from '@/core/types';
import type { Grade, MotionEffect, BackgroundLayer } from '@/schemas/template.schemas';

// ---------------------------------------------------------------------------
// NOTE on FormatterManager round-trips:
// FormatterManager is DI-injected (tsyringe) and requires a live container with
// project/template/segment/logger registrations. Instantiating it standalone
// without a DI container would require a complex mock harness. The exact ffmpeg
// string output is fully deterministic from the Filter shape alone — FormatterManager
// applies: value path → `type=value`; values path → `type=k1=v1:k2=v2` (with
// special-casing for color/text/duration keys). The exact string assertions below
// prove the filter shapes are correct by construction. To verify the round-trip
// manually: `new FormatterManager(...).formatMultipleTypesValue(f)` for value
// filters and `.formatMultipleTypesValues(f)` for values filters.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// lookToFilters
// ---------------------------------------------------------------------------

describe('lookToFilters', () => {
  it('returns [] for undefined', () => {
    expect(lookToFilters(undefined)).toEqual([]);
  });

  it('returns [] for unknown look', () => {
    expect(lookToFilters('unknown_look')).toEqual([]);
  });

  it('cinematic: eq with contrast/saturation/gamma + colorbalance', () => {
    const filters = lookToFilters('cinematic');
    expect(filters).toEqual<Filter[]>([
      { type: 'eq', value: 'contrast=1.12:saturation=1.18:gamma=0.95' },
      { type: 'colorbalance', value: 'bs=0.06:rs=-0.03' },
    ]);
  });

  it('warm: single colorbalance', () => {
    expect(lookToFilters('warm')).toEqual<Filter[]>([{ type: 'colorbalance', value: 'rs=0.08:rm=0.05:bs=-0.06' }]);
  });

  it('cool: single colorbalance', () => {
    expect(lookToFilters('cool')).toEqual<Filter[]>([{ type: 'colorbalance', value: 'bs=0.08:bm=0.04:rs=-0.05' }]);
  });

  it('vintage: curves preset + eq saturation', () => {
    expect(lookToFilters('vintage')).toEqual<Filter[]>([
      { type: 'curves', value: 'preset=vintage' },
      { type: 'eq', value: 'saturation=0.85' },
    ]);
  });

  it('noir: hue + eq contrast/brightness', () => {
    expect(lookToFilters('noir')).toEqual<Filter[]>([
      { type: 'hue', value: 's=0' },
      { type: 'eq', value: 'contrast=1.25:brightness=0.02' },
    ]);
  });

  it('vivid: single eq saturation/contrast', () => {
    expect(lookToFilters('vivid')).toEqual<Filter[]>([{ type: 'eq', value: 'saturation=1.35:contrast=1.08' }]);
  });

  it('dreamy: gblur + eq brightness/saturation', () => {
    expect(lookToFilters('dreamy')).toEqual<Filter[]>([
      { type: 'gblur', value: 'sigma=0.8' },
      { type: 'eq', value: 'brightness=0.04:saturation=1.1' },
    ]);
  });

  it('purity: mutating a returned filter does not corrupt subsequent calls', () => {
    const first = lookToFilters('warm');
    first[0].value = 'MUTATED';
    const second = lookToFilters('warm');
    expect(second[0].value).toBe('rs=0.08:rm=0.05:bs=-0.06');
  });
});

// ---------------------------------------------------------------------------
// gradeToFilters
// ---------------------------------------------------------------------------

describe('gradeToFilters', () => {
  it('returns [] for undefined', () => {
    expect(gradeToFilters(undefined)).toEqual([]);
  });

  it('returns [] for empty grade object', () => {
    expect(gradeToFilters({})).toEqual([]);
  });

  it('brightness only → single eq with brightness', () => {
    expect(gradeToFilters({ brightness: 0.1 })).toEqual<Filter[]>([{ type: 'eq', value: 'brightness=0.1' }]);
  });

  it('contrast only → single eq with contrast', () => {
    expect(gradeToFilters({ contrast: 1.2 })).toEqual<Filter[]>([{ type: 'eq', value: 'contrast=1.2' }]);
  });

  it('full grade object → eq (4 fields) + hue + colorbalance + gblur + curves in stable order', () => {
    const grade: Grade = {
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1.3,
      gamma: 0.9,
      hue: 45,
      colorBalance: {
        shadows: { r: 0.1, g: 0.0, b: -0.1 },
        midtones: { r: 0.05 },
        highlights: { b: 0.08 },
      },
      blur: 1.5,
      curvesPreset: 'warm',
    };

    const filters = gradeToFilters(grade);

    expect(filters).toEqual<Filter[]>([
      { type: 'eq', value: 'brightness=0.1:contrast=1.2:saturation=1.3:gamma=0.9' },
      { type: 'hue', value: 'h=45' },
      { type: 'colorbalance', value: 'rs=0.1:gs=0:bs=-0.1:rm=0.05:bh=0.08' },
      { type: 'gblur', value: 'sigma=1.5' },
      { type: 'curves', value: 'preset=warm' },
    ]);
  });

  it('hue only → single hue filter', () => {
    expect(gradeToFilters({ hue: -30 })).toEqual<Filter[]>([{ type: 'hue', value: 'h=-30' }]);
  });

  it('blur=0 → no gblur filter emitted', () => {
    const filters = gradeToFilters({ blur: 0 });
    expect(filters.some((f) => f.type === 'gblur')).toBe(false);
  });

  it('blur > 0 → gblur emitted', () => {
    expect(gradeToFilters({ blur: 2 })).toEqual<Filter[]>([{ type: 'gblur', value: 'sigma=2' }]);
  });

  it('colorBalance shadows only → colorbalance with rs/gs/bs', () => {
    expect(gradeToFilters({ colorBalance: { shadows: { r: 0.05, g: -0.02, b: 0.01 } } })).toEqual<Filter[]>([
      { type: 'colorbalance', value: 'rs=0.05:gs=-0.02:bs=0.01' },
    ]);
  });

  it('colorBalance with empty sub-objects → no colorbalance filter', () => {
    const filters = gradeToFilters({ colorBalance: { shadows: {} } });
    expect(filters.some((f) => f.type === 'colorbalance')).toBe(false);
  });

  it('curvesPreset only → single curves filter', () => {
    expect(gradeToFilters({ curvesPreset: 'vintage' })).toEqual<Filter[]>([
      { type: 'curves', value: 'preset=vintage' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// motionToFilters
// ---------------------------------------------------------------------------

const CTX_6S = { duration: 6, scale: '1280:720', fps: 30 };
// frames = round(6 * 30) = 180
// step (default intensity=1.15) = (1.15-1)/180 = 0.000833...rounded to 6dp = 0.000833

describe('motionToFilters', () => {
  it('returns [] for undefined', () => {
    expect(motionToFilters(undefined, CTX_6S)).toEqual([]);
  });

  it('returns [] for empty array', () => {
    expect(motionToFilters([], CTX_6S)).toEqual([]);
  });

  describe('kenburns in', () => {
    it('emits pre-upscale + zoompan with min(zoom+step,intensity)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'in', intensity: 1.15 }], CTX_6S);
      expect(filters).toHaveLength(2);

      const [upscale, zp] = filters;
      expect(upscale).toEqual<Filter>({ type: 'scale', value: '2560:-2' });

      expect(zp.type).toBe('zoompan');
      const val = String(zp.value);
      expect(val).toContain("z='min(zoom+0.000833,1.15)'");
      expect(val).toContain("x='iw/2-(iw/zoom/2)'");
      expect(val).toContain("y='ih/2-(ih/zoom/2)'");
      expect(val).toContain(':d=180:s=1280x720:fps=30');
    });

    it('uses default intensity 1.15 and direction in when both omitted', () => {
      const filters = motionToFilters([{ type: 'kenburns' }], CTX_6S);
      const zp = filters[1];
      expect(String(zp.value)).toContain("z='min(zoom+0.000833,1.15)'");
    });
  });

  describe('kenburns out', () => {
    it('emits zoompan with if(eq(on,1),intensity,...) pattern', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'out', intensity: 1.15 }], CTX_6S);
      expect(filters).toHaveLength(2);

      const [upscale, zp] = filters;
      expect(upscale).toEqual<Filter>({ type: 'scale', value: '2560:-2' });

      const val = String(zp.value);
      expect(val).toContain("z='if(eq(on,1),1.15,max(zoom-0.000833,1.0))'");
      expect(val).toContain(':d=180:s=1280x720:fps=30');
    });
  });

  describe('kenburns left', () => {
    it('emits zoompan with x panning left-to-right (increasing x)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'left', intensity: 1.15 }], CTX_6S);
      const zp = filters[1];
      const val = String(zp.value);
      expect(val).toContain("z='1.15'");
      expect(val).toContain("x='(iw-iw/zoom)*(on/180)'");
      expect(val).toContain("y='ih/2-(ih/zoom/2)'");
      expect(val).toContain(':d=180:s=1280x720:fps=30');
    });
  });

  describe('kenburns right', () => {
    it('emits zoompan with x panning right-to-left (decreasing x)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'right', intensity: 1.15 }], CTX_6S);
      const zp = filters[1];
      const val = String(zp.value);
      expect(val).toContain("z='1.15'");
      expect(val).toContain("x='(iw-iw/zoom)*(1-on/180)'");
      expect(val).toContain("y='ih/2-(ih/zoom/2)'");
    });
  });

  describe('kenburns up', () => {
    it('emits zoompan with y panning upward (increasing y offset)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'up', intensity: 1.15 }], CTX_6S);
      const zp = filters[1];
      const val = String(zp.value);
      expect(val).toContain("y='(ih-ih/zoom)*(on/180)'");
    });
  });

  describe('kenburns down', () => {
    it('emits zoompan with y panning downward (decreasing y offset)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'down', intensity: 1.15 }], CTX_6S);
      const zp = filters[1];
      const val = String(zp.value);
      expect(val).toContain("y='(ih-ih/zoom)*(1-on/180)'");
    });
  });

  // Video sections must not be time-stretched by zoompan: d=1 emits exactly one output frame per
  // input frame, while `frames` still calibrates the zoom/pan curve over the clip's real (probed)
  // length. Stills keep d=frames (the blocks above). See kenburnsToFilters / injectSugarFilters.
  describe('kenburns on video (isVideo → d=1)', () => {
    const CTX_VIDEO = { duration: 9, scale: '1280:720', fps: 30, isVideo: true }; // frames = 270

    it('conforms fps, then pre-upscales, then a d=1 zoompan calibrated over the real frame count', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'in', intensity: 1.2 }], CTX_VIDEO);
      expect(filters).toHaveLength(3);

      // fps conform first so a non-30fps clip keeps real time under the d=1 1:1 frame mapping.
      expect(filters[0]).toEqual<Filter>({ type: 'fps', value: '30' });
      expect(filters[1]).toEqual<Filter>({ type: 'scale', value: '2560:-2' });

      const zp = filters[2];
      expect(zp.type).toBe('zoompan');
      const val = String(zp.value);
      expect(val).toContain("z='min(zoom+0.000741,1.2)'"); // step = (1.2-1)/270
      expect(val).toContain(':d=1:s=1280x720:fps=30');
      expect(val).not.toContain(':d=270:');
    });

    it('pans over the real frame count with d=1 (left)', () => {
      const filters = motionToFilters([{ type: 'kenburns', direction: 'left', intensity: 1.2 }], CTX_VIDEO);
      const zp = filters.find((f) => f.type === 'zoompan');
      const val = String(zp?.value);
      expect(val).toContain("x='(iw-iw/zoom)*(on/270)'");
      expect(val).toContain(':d=1:');
    });

    it('stills are unaffected: the same effect without isVideo keeps d=frames', () => {
      const stillCtx = { duration: 9, scale: '1280:720', fps: 30 };
      const val = String(motionToFilters([{ type: 'kenburns', direction: 'in', intensity: 1.2 }], stillCtx)[1].value);
      expect(val).toContain(':d=270:');
    });
  });

  describe('rotate', () => {
    it('emits rotate filter with angle expression', () => {
      const filters = motionToFilters([{ type: 'rotate', angle: 90 }], CTX_6S);
      expect(filters).toEqual<Filter[]>([{ type: 'rotate', value: '90*PI/180:c=black' }]);
    });

    it('supports negative angles', () => {
      const filters = motionToFilters([{ type: 'rotate', angle: -45 }], CTX_6S);
      expect(filters[0]).toEqual<Filter>({ type: 'rotate', value: '-45*PI/180:c=black' });
    });

    it('ffmpeg string check: value filter shape', () => {
      const [f] = motionToFilters([{ type: 'rotate', angle: 90 }], CTX_6S);
      expect(`${f.type}=${f.value}`).toBe('rotate=90*PI/180:c=black');
    });
  });

  describe('crop', () => {
    it('emits crop with explicit w/h/x/y', () => {
      const filters = motionToFilters([{ type: 'crop', w: 640, h: 360, x: 10, y: 20 }], CTX_6S);
      expect(filters).toEqual<Filter[]>([{ type: 'crop', value: '640:360:10:20' }]);
    });

    it('uses default (iw-ow)/2 and (ih-oh)/2 when x and y omitted', () => {
      const filters = motionToFilters([{ type: 'crop', w: 640, h: 360 }], CTX_6S);
      expect(filters).toEqual<Filter[]>([{ type: 'crop', value: '640:360:(iw-ow)/2:(ih-oh)/2' }]);
    });

    it('supports string expressions for w/h/x/y', () => {
      const filters = motionToFilters([{ type: 'crop', w: 'iw/2', h: 'ih/2', x: 'iw/4', y: 'ih/4' }], CTX_6S);
      expect(filters[0]).toEqual<Filter>({ type: 'crop', value: 'iw/2:ih/2:iw/4:ih/4' });
    });
  });

  describe('flip', () => {
    it('horizontal axis → hflip (no value)', () => {
      const filters = motionToFilters([{ type: 'flip', axis: 'horizontal' }], CTX_6S);
      expect(filters).toEqual<Filter[]>([{ type: 'hflip' }]);
    });

    it('vertical axis → vflip (no value)', () => {
      const filters = motionToFilters([{ type: 'flip', axis: 'vertical' }], CTX_6S);
      expect(filters).toEqual<Filter[]>([{ type: 'vflip' }]);
    });

    it('ffmpeg string check: bare-type filter shape', () => {
      const [f] = motionToFilters([{ type: 'flip', axis: 'horizontal' }], CTX_6S);
      expect(f.type).toBe('hflip');
      expect(f.value).toBeUndefined();
    });
  });

  it('concatenates multiple effects in order', () => {
    const motion: MotionEffect[] = [
      { type: 'flip', axis: 'horizontal' },
      { type: 'rotate', angle: 10 },
    ];
    const filters = motionToFilters(motion, CTX_6S);
    expect(filters).toHaveLength(2);
    expect(filters[0].type).toBe('hflip');
    expect(filters[1].type).toBe('rotate');
  });

  it('kenburns + flip emits 3 filters total (upscale, zoompan, hflip)', () => {
    const motion: MotionEffect[] = [
      { type: 'kenburns', direction: 'in' },
      { type: 'flip', axis: 'horizontal' },
    ];
    const filters = motionToFilters(motion, CTX_6S);
    expect(filters).toHaveLength(3);
    expect(filters[0].type).toBe('scale');
    expect(filters[1].type).toBe('zoompan');
    expect(filters[2].type).toBe('hflip');
  });
});

// ---------------------------------------------------------------------------
// layersToFilters
// ---------------------------------------------------------------------------

describe('layersToFilters', () => {
  it('returns [] for undefined', () => {
    expect(layersToFilters(undefined)).toEqual([]);
  });

  it('returns [] for empty array', () => {
    expect(layersToFilters([])).toEqual([]);
  });

  it('single solid layer with all fields → drawbox with filled defaults', () => {
    const layers: BackgroundLayer[] = [{ color: '#FF0000', opacity: 0.5, x: 10, y: 20, w: 100, h: 50 }];
    expect(layersToFilters(layers)).toEqual<Filter[]>([
      {
        type: 'drawbox',
        values: { x: 10, y: 20, w: 100, h: 50, c: '#FF0000@0.5', t: 'fill' },
      },
    ]);
  });

  it('layer with color but no x/y/w/h → defaults to 0/0/iw/ih', () => {
    const layers: BackgroundLayer[] = [{ color: 'black' }];
    expect(layersToFilters(layers)).toEqual<Filter[]>([
      {
        type: 'drawbox',
        values: { x: 0, y: 0, w: 'iw', h: 'ih', c: 'black@1', t: 'fill' },
      },
    ]);
  });

  it('layer with color but no opacity → defaults opacity to 1', () => {
    const [f] = layersToFilters([{ color: 'white' }]);
    expect((f.values as Record<string, unknown>).c).toBe('white@1');
  });

  it('gradient layer → skipped', () => {
    const layers: BackgroundLayer[] = [{ gradient: { from: '#000000', to: '#FFFFFF', direction: 'vertical' } }];
    expect(layersToFilters(layers)).toEqual([]);
  });

  it('layer with neither color nor gradient → skipped', () => {
    const layers: BackgroundLayer[] = [{ x: 0, y: 0, w: 100, h: 100 }];
    expect(layersToFilters(layers)).toEqual([]);
  });

  it('two solid layers, one gradient → only solid layers emitted', () => {
    const layers: BackgroundLayer[] = [
      { color: 'red' },
      { gradient: { from: '#000', to: '#FFF' } },
      { color: 'blue', opacity: 0.8 },
    ];
    const filters = layersToFilters(layers);
    expect(filters).toHaveLength(2);
    expect((filters[0].values as Record<string, unknown>).c).toBe('red@1');
    expect((filters[1].values as Record<string, unknown>).c).toBe('blue@0.8');
  });

  it('layer with color and gradient → gradient takes precedence (layer skipped)', () => {
    // When both color and gradient are present, gradient wins (skip the layer)
    const layers: BackgroundLayer[] = [{ color: 'red', gradient: { from: '#000', to: '#FFF' } }];
    expect(layersToFilters(layers)).toEqual([]);
  });

  it('ffmpeg string check: values-object filter shape (drawbox)', () => {
    const [f] = layersToFilters([{ color: '#FF0000', opacity: 0.5, x: 10, y: 20, w: 100, h: 50 }]);
    // FormatterManager.formatMultipleTypesValues iterates Object.keys and uses:
    // - x, y, w, h, t: default path → `key=${val}` (no quotes)
    // - c: color path → `c='#FF0000@0.5'` (with quotes)
    const values = f.values as Record<string, unknown>;
    expect(values.x).toBe(10);
    expect(values.y).toBe(20);
    expect(values.w).toBe(100);
    expect(values.h).toBe(50);
    expect(values.c).toBe('#FF0000@0.5');
    expect(values.t).toBe('fill');
  });

  it('purity: mutating a returned values object does not affect subsequent calls', () => {
    const first = layersToFilters([{ color: 'red' }]);
    (first[0].values as Record<string, unknown>).c = 'MUTATED';
    const second = layersToFilters([{ color: 'red' }]);
    expect((second[0].values as Record<string, unknown>).c).toBe('red@1');
  });
});
