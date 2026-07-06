// The direction control is an 8-arrow angle picker, but the descriptor keeps the legacy
// direction enum as sugar: the three angles the enum can express are emitted AS the enum
// (byte-identical descriptors for old options); every other arrow emits the free `angle`
// field. Reading goes the other way: angle wins, then the enum, then the vertical default.
import { describe, it, expect } from 'vitest';
import { sweepToAngle, applySweepAngle } from './gradient-angle';

const gradient = { from: '#000000', to: '#ffffff' };

describe('sweepToAngle', () => {
  it('defaults to 180 (top→bottom), the engine vertical default', () => {
    expect(sweepToAngle(gradient)).toBe(180);
  });

  it('maps the legacy direction enum onto its angle', () => {
    expect(sweepToAngle({ ...gradient, direction: 'horizontal' })).toBe(90);
    expect(sweepToAngle({ ...gradient, direction: 'vertical' })).toBe(180);
    expect(sweepToAngle({ ...gradient, direction: 'diagonal' })).toBe(135);
  });

  it('prefers a free angle over the enum and normalises it into 0..360', () => {
    expect(sweepToAngle({ ...gradient, angle: 270, direction: 'horizontal' })).toBe(270);
    expect(sweepToAngle({ ...gradient, angle: -45 })).toBe(315);
    expect(sweepToAngle({ ...gradient, angle: 450 })).toBe(90);
  });
});

describe('applySweepAngle', () => {
  it('emits the legacy enum (no angle field) for the three angles it can express', () => {
    expect(applySweepAngle(gradient, 90)).toEqual({ ...gradient, direction: 'horizontal' });
    expect(applySweepAngle(gradient, 180)).toEqual({ ...gradient, direction: 'vertical' });
    expect(applySweepAngle(gradient, 135)).toEqual({ ...gradient, direction: 'diagonal' });
  });

  it('emits a free angle (no direction field) for the sweeps the enum lacks', () => {
    expect(applySweepAngle(gradient, 0)).toEqual({ ...gradient, angle: 0 });
    expect(applySweepAngle(gradient, 270)).toEqual({ ...gradient, angle: 270 });
  });

  it('drops the stale counterpart field when switching between enum and free sweeps', () => {
    expect(applySweepAngle({ ...gradient, angle: 225 }, 180)).toEqual({ ...gradient, direction: 'vertical' });
    expect(applySweepAngle({ ...gradient, direction: 'vertical' }, 315)).toEqual({ ...gradient, angle: 315 });
  });

  it('keeps unrelated gradient fields (colours, shape) untouched', () => {
    const shaped = { ...gradient, shape: 'linear' as const };
    expect(applySweepAngle(shaped, 45)).toEqual({ ...shaped, angle: 45 });
  });
});
