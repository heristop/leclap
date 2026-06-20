import { describe, it, expect } from 'vitest';
import { layerPercents, movedGeometry, resizedGeometry, MIN_LAYER_PERCENT } from './layerDrag';

describe('layerPercents', () => {
  it('reads iw/ih expressions back to percentages', () => {
    expect(layerPercents({ color: '#000', x: 'iw*0.25', y: 'ih*0.10', w: 'iw*0.50', h: 'ih*0.40' })).toEqual({
      x: 25,
      y: 10,
      w: 50,
      h: 40,
    });
  });

  it('falls back to the default centred half-frame box for unset axes', () => {
    expect(layerPercents({ color: '#000' })).toEqual({ x: 25, y: 25, w: 50, h: 50 });
  });
});

describe('movedGeometry', () => {
  it('writes the dragged top-left as iw/ih expressions', () => {
    expect(movedGeometry(30, 20, 50, 40)).toEqual({ x: 'iw*0.3000', y: 'ih*0.2000' });
  });

  it('clamps so the box stays fully inside the frame', () => {
    // A 50%-wide / 40%-tall box can sit at most at x=50, y=60.
    expect(movedGeometry(90, 90, 50, 40)).toEqual({ x: 'iw*0.5000', y: 'ih*0.6000' });
  });

  it('clamps negative positions to the top-left edge', () => {
    expect(movedGeometry(-10, -5, 50, 40)).toEqual({ x: 'iw*0.0000', y: 'ih*0.0000' });
  });
});

describe('resizedGeometry', () => {
  it('sizes from a fixed top-left to the dragged bottom-right', () => {
    expect(resizedGeometry(20, 10, 70, 60)).toEqual({ w: 'iw*0.5000', h: 'ih*0.5000' });
  });

  it('clamps to a minimum size when dragged above/left of the top-left', () => {
    const { w, h } = resizedGeometry(40, 40, 41, 41);
    expect(w).toBe(`iw*${(MIN_LAYER_PERCENT / 100).toFixed(4)}`);
    expect(h).toBe(`ih*${(MIN_LAYER_PERCENT / 100).toFixed(4)}`);
  });

  it('clamps the size to the frame edge', () => {
    expect(resizedGeometry(60, 50, 200, 200)).toEqual({ w: 'iw*0.4000', h: 'ih*0.5000' });
  });
});
