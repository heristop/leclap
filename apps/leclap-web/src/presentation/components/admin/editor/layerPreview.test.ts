// The CSS swatch must mirror the engine's gradients `type=` lowering: linear keeps the direction
// sweep, radial fills from the centre, circular/spiral are angular sweeps (CSS conic is the closest
// preview for both — CSS cannot twist the angle by radius the way the spiral type does).
import { describe, it, expect } from 'vitest';
import { layerFill } from './layerPreview';

describe('layerFill gradient shapes', () => {
  const gradient = { from: '#000000', to: '#ffffff' };

  it('keeps the direction-driven linear gradient when shape is unset or linear', () => {
    expect(layerFill({ gradient }).background).toBe('linear-gradient(to bottom, #000000, #ffffff)');
    expect(layerFill({ gradient: { ...gradient, shape: 'linear', direction: 'horizontal' } }).background).toBe(
      'linear-gradient(to right, #000000, #ffffff)'
    );
  });

  it('renders a centred radial fill for shape=radial', () => {
    expect(layerFill({ gradient: { ...gradient, shape: 'radial' } }).background).toBe(
      'radial-gradient(circle at center, #000000, #ffffff)'
    );
  });

  it('renders an angular conic sweep for circular and spiral shapes', () => {
    expect(layerFill({ gradient: { ...gradient, shape: 'circular' } }).background).toBe(
      'conic-gradient(from 0deg at center, #000000, #ffffff)'
    );
    expect(layerFill({ gradient: { ...gradient, shape: 'spiral' } }).background).toBe(
      'conic-gradient(from 0deg at center, #000000, #ffffff)'
    );
  });
});
