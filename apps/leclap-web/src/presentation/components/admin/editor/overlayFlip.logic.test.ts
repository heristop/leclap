import { describe, it, expect } from 'vitest';
import { flipCssTransform, hasFlipAxis, toggleFlipAxis } from './overlayFlip.logic';

describe('hasFlipAxis', () => {
  it('reads each axis out of the combined flip value', () => {
    expect(hasFlipAxis(undefined, 'horizontal')).toBe(false);
    expect(hasFlipAxis(undefined, 'vertical')).toBe(false);
    expect(hasFlipAxis('horizontal', 'horizontal')).toBe(true);
    expect(hasFlipAxis('horizontal', 'vertical')).toBe(false);
    expect(hasFlipAxis('vertical', 'vertical')).toBe(true);
    expect(hasFlipAxis('both', 'horizontal')).toBe(true);
    expect(hasFlipAxis('both', 'vertical')).toBe(true);
  });
});

describe('toggleFlipAxis', () => {
  it('turns a single axis on from the unflipped state', () => {
    expect(toggleFlipAxis(undefined, 'horizontal')).toBe('horizontal');
    expect(toggleFlipAxis(undefined, 'vertical')).toBe('vertical');
  });

  it('turns the only active axis off back to undefined', () => {
    expect(toggleFlipAxis('horizontal', 'horizontal')).toBeUndefined();
    expect(toggleFlipAxis('vertical', 'vertical')).toBeUndefined();
  });

  it('combines the second axis into "both"', () => {
    expect(toggleFlipAxis('horizontal', 'vertical')).toBe('both');
    expect(toggleFlipAxis('vertical', 'horizontal')).toBe('both');
  });

  it('drops one axis out of "both", keeping the other', () => {
    expect(toggleFlipAxis('both', 'horizontal')).toBe('vertical');
    expect(toggleFlipAxis('both', 'vertical')).toBe('horizontal');
  });
});

describe('flipCssTransform', () => {
  it('maps each flip value to its CSS mirror fragment', () => {
    expect(flipCssTransform(undefined)).toBe('');
    expect(flipCssTransform('horizontal')).toBe('scaleX(-1)');
    expect(flipCssTransform('vertical')).toBe('scaleY(-1)');
    expect(flipCssTransform('both')).toBe('scale(-1, -1)');
  });
});
