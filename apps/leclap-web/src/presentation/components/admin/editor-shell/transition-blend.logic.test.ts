import { describe, it, expect } from 'vitest';
import { transitionBlendAt, type BlendStyle } from './transition-blend.logic';
import type { PreviewFamily } from '../editor/transitionGroups';

const FAMILIES: PreviewFamily[] = [
  'fade',
  'wipe',
  'slide',
  'circle',
  'slice',
  'cover',
  'reveal',
  'zoom',
  'blur',
  'pixel',
];

// The incoming layer must be effectively hidden at p=0 and fully shown at p=1 — via opacity,
// a zero-area clip, or an off-screen transform.
const incomingHiddenAt0 = (style: BlendStyle['incoming']): boolean => {
  if (style.opacity !== undefined && style.opacity === 0) return true;

  if (style.clipPath?.includes('100.00%')) return true;

  if (style.clipPath?.includes('circle(0.00%')) return true;

  return style.transform?.includes('100.00%') ?? false;
};

describe('transitionBlendAt', () => {
  it('hides the incoming scene at p=0 for every family', () => {
    for (const family of FAMILIES) {
      const { incoming } = transitionBlendAt(family, 0);
      expect(incomingHiddenAt0(incoming), `family ${family}`).toBe(true);
    }
  });

  it('fully shows the incoming scene at p=1 for every family', () => {
    for (const family of FAMILIES) {
      const { incoming } = transitionBlendAt(family, 1);
      const shown =
        (incoming.opacity === undefined || incoming.opacity === 1) &&
        !incoming.clipPath?.includes('100.00%') &&
        !incoming.transform?.includes('100.00%');
      expect(shown, `family ${family}`).toBe(true);
    }
  });

  it('crossfades opacities for fade', () => {
    const mid = transitionBlendAt('fade', 0.5);
    expect(mid.outgoing.opacity).toBeCloseTo(0.5, 5);
    expect(mid.incoming.opacity).toBeCloseTo(0.5, 5);
  });

  it('clamps out-of-range progress', () => {
    expect(transitionBlendAt('fade', -1).incoming.opacity).toBe(0);
    expect(transitionBlendAt('fade', 2).incoming.opacity).toBe(1);
  });

  it('wipes reveal horizontally, slices vertically', () => {
    expect(transitionBlendAt('wipe', 0.5).incoming.clipPath).toBe('inset(0 50.00% 0 0)');
    expect(transitionBlendAt('slice', 0.5).incoming.clipPath).toBe('inset(0 0 50.00% 0)');
  });

  it('slides both layers in tandem', () => {
    const mid = transitionBlendAt('slide', 0.5);
    expect(mid.outgoing.transform).toBe('translateX(-50.00%)');
    expect(mid.incoming.transform).toBe('translateX(50.00%)');
  });

  it('falls back to fade for unknown families', () => {
    const odd = transitionBlendAt('unknown' as PreviewFamily, 0.25);
    expect(odd.incoming.opacity).toBeCloseTo(0.25, 5);
  });
});
