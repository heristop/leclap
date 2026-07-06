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

  it('mirrors a free angle as a CSS-degree linear gradient, winning over the direction enum', () => {
    // The engine's angle field uses the CSS convention, so the swatch passes degrees straight through.
    expect(layerFill({ gradient: { ...gradient, angle: 270 } }).background).toBe(
      'linear-gradient(270deg, #000000, #ffffff)'
    );
    expect(layerFill({ gradient: { ...gradient, angle: 45, direction: 'vertical' } }).background).toBe(
      'linear-gradient(45deg, #000000, #ffffff)'
    );
  });

  it('ignores the angle for non-linear shapes, matching the engine lowering', () => {
    expect(layerFill({ gradient: { ...gradient, angle: 90, shape: 'radial' } }).background).toBe(
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

// The engine draws the border as a drawbox with numeric thickness t along the box edge, extending
// inward — an inset box-shadow is the CSS mirror. The width is authored in ENGINE output px, so the
// swatch scales it by the preview-px-per-engine-px factor (clamped to 1px so thin strokes stay visible).
describe('layerFill border outline', () => {
  it('renders no box-shadow when the layer has no border', () => {
    expect(layerFill({ color: '#112233' }).boxShadow).toBeUndefined();
  });

  it('mirrors a stroked fill as an inset box-shadow over the background', () => {
    const style = layerFill({ color: '#112233', border: { color: '#ffffff', width: 4 } });

    expect(style.background).toBe('#112233');
    expect(style.boxShadow).toBe('inset 0 0 0 4px #ffffff');
  });

  it('renders an outline-only layer (no fill) as a transparent background with the stroke', () => {
    const style = layerFill({ border: { color: '#00ff00', width: 6 } });

    expect(style.background).toBe('transparent');
    expect(style.boxShadow).toBe('inset 0 0 0 6px #00ff00');
  });

  it('scales the engine-px width by the preview factor, clamped to 1px', () => {
    expect(layerFill({ border: { color: '#fff', width: 8 } }, undefined, 0.5).boxShadow).toBe(
      'inset 0 0 0 4px #fff'
    );
    // 0 scale = frame not measured yet (first paint): keep a hairline instead of vanishing.
    expect(layerFill({ border: { color: '#fff', width: 8 } }, undefined, 0).boxShadow).toBe(
      'inset 0 0 0 1px #fff'
    );
  });
});
