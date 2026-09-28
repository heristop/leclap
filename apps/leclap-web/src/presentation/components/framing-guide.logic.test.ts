import { describe, it, expect } from 'vitest';
import { DEFAULT_FRAMING_OPACITY } from '@/presentation/components/admin/templateEditorModel';
import { guideLayers } from './framing-guide.logic';

describe('guideLayers', () => {
  it('gives the default guide a line that reads on any feed, a soft halo and a light dim', () => {
    const layers = guideLayers(DEFAULT_FRAMING_OPACITY);

    expect(layers.line).toBeCloseTo(0.8);
    expect(layers.halo).toBeCloseTo(0.35);
    expect(layers.dim).toBeCloseTo(0.25);
  });

  it('scales every layer with the template’s opacity', () => {
    const faint = guideLayers(0.2);
    const normal = guideLayers(DEFAULT_FRAMING_OPACITY);

    expect(faint.line).toBeLessThan(normal.line);
    expect(faint.halo).toBeLessThan(normal.halo);
    expect(faint.dim).toBeLessThan(normal.dim);
  });

  it('caps a full-strength guide short of hiding the scene', () => {
    expect(guideLayers(1)).toEqual({ line: 1, halo: 0.6, dim: 0.4 });
  });

  it('turns fully off at zero', () => {
    expect(guideLayers(0)).toEqual({ line: 0, halo: 0, dim: 0 });
    expect(guideLayers(-1)).toEqual({ line: 0, halo: 0, dim: 0 });
  });
});
