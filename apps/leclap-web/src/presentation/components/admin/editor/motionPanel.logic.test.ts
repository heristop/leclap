import { describe, it, expect } from 'vitest';
import {
  MOTION_KINDS,
  activeMotion,
  defaultMotion,
  writeMotion,
  cropExpr,
  cropPercent,
  DEFAULT_CROP_PERCENT,
} from './motionPanel.logic';

describe('activeMotion / writeMotion', () => {
  it('reads the first effect and writes a single-effect list', () => {
    const rotate = { type: 'rotate', angle: 45 } as const;
    expect(activeMotion([rotate])).toEqual(rotate);
    expect(activeMotion(undefined)).toBeNull();
    expect(activeMotion([])).toBeNull();
    expect(writeMotion(rotate)).toEqual([rotate]);
    expect(writeMotion(null)).toBeUndefined();
  });
});

describe('defaultMotion', () => {
  it('produces a valid default for every kind', () => {
    expect(defaultMotion('kenburns')).toEqual({ type: 'kenburns', direction: 'in', intensity: 1.15 });
    expect(defaultMotion('rotate')).toEqual({ type: 'rotate', angle: 90 });
    expect(defaultMotion('flip')).toEqual({ type: 'flip', axis: 'horizontal' });
    expect(defaultMotion('crop')).toEqual({ type: 'crop', w: 'iw*0.80', h: 'ih*0.80' });
    expect(defaultMotion('shake')).toEqual({ type: 'shake', intensity: 6, frequency: 2 });
    expect(defaultMotion('pulse')).toEqual({ type: 'pulse', intensity: 1.08, frequency: 1 });
  });

  it('covers every engine motion kind', () => {
    for (const kind of MOTION_KINDS) {
      expect(defaultMotion(kind).type).toBe(kind);
    }
  });
});

describe('cropExpr / cropPercent', () => {
  it('emits centered percent expressions and reads them back', () => {
    expect(cropExpr('iw', 80)).toBe('iw*0.80');
    expect(cropExpr('ih', 55)).toBe('ih*0.55');
    expect(cropPercent('iw*0.80')).toBe(80);
    expect(cropPercent('ih*0.55')).toBe(55);
  });

  it('clamps out-of-range percents', () => {
    expect(cropExpr('iw', 150)).toBe('iw*1.00');
    expect(cropExpr('iw', 0)).toBe('iw*0.01');
  });

  it('falls back to the default for foreign values', () => {
    expect(cropPercent(640)).toBe(DEFAULT_CROP_PERCENT);
    expect(cropPercent(undefined)).toBe(DEFAULT_CROP_PERCENT);
    expect(cropPercent('(iw-ow)/2')).toBe(DEFAULT_CROP_PERCENT);
  });
});
