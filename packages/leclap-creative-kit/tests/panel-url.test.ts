import { describe, it, expect } from 'vitest';
import { buildPanelUrl, parsePanelUrl, type PanelSpec } from '../src/editor/panel-url';

describe('buildPanelUrl / parsePanelUrl round trip', () => {
  it('round-trips a fully-specified spec through all five params', () => {
    const spec: PanelSpec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };
    const url = buildPanelUrl(spec);

    expect(parsePanelUrl(url)).toEqual(spec);
  });

  it('round-trips a non-default radius/color/opacity combination', () => {
    const spec: PanelSpec = { width: 640, height: 200, radius: 12, color: 'ff00aa', opacity: 0.35 };
    const url = buildPanelUrl(spec);

    expect(parsePanelUrl(url)).toEqual(spec);
  });

  it('omits radius, color and opacity from the URL when they equal the engine defaults', () => {
    const spec: PanelSpec = { width: 500, height: 220, radius: 24, color: '0a0f14', opacity: 0.72 };
    const url = buildPanelUrl(spec);

    expect(url).toBe('panel:w=500,h=220');
  });

  it('keeps only the params that differ from defaults for the shortest stable form', () => {
    const spec: PanelSpec = { width: 500, height: 220, radius: 10, color: '0a0f14', opacity: 0.72 };

    expect(buildPanelUrl(spec)).toBe('panel:w=500,h=220,r=10');
  });

  it('always emits width and height even when they happen to match nothing special', () => {
    const spec: PanelSpec = { width: 100, height: 100, radius: 24, color: '0a0f14', opacity: 0.72 };

    expect(buildPanelUrl(spec)).toBe('panel:w=100,h=100');
  });

  it('re-exports parsePanelUrl untouched, including its malformed-input handling', () => {
    expect(parsePanelUrl('not-a-panel-url')).toBeNull();
    expect(parsePanelUrl('panel:w=0,h=100')).toBeNull();
    expect(parsePanelUrl('panel:h=100')).toBeNull();
  });
});
