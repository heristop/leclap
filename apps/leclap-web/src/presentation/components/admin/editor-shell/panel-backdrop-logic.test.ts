import { describe, it, expect } from 'vitest';
import type { ImageOverlay } from '../templateEditorModel';
import { panelSpecOf, regeneratedPanelPatch } from './panel-backdrop-logic';

describe('panelSpecOf', () => {
  it('parses a panel: choice url into its spec', () => {
    const overlay: ImageOverlay = {
      id: 'panel-1',
      choice: { source: 'url', url: 'panel:w=380,h=150,r=28,c=0a0f14,o=0.72' },
    };

    expect(panelSpecOf(overlay)).toEqual({ width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 });
  });

  it('returns null for a plain picked image (library/upload source)', () => {
    expect(panelSpecOf({ id: 'i', choice: { source: 'library', id: 'sample' } })).toBeNull();
    expect(panelSpecOf({ id: 'i', choice: { source: 'upload', key: 'k', label: 'l' } })).toBeNull();
  });

  it('returns null for a url choice that is not a panel: scheme (e.g. a rasterized shape)', () => {
    expect(panelSpecOf({ id: 'i', choice: { source: 'url', url: 'data:image/png;base64,AAAA' } })).toBeNull();
  });
});

describe('regeneratedPanelPatch', () => {
  it('merges the spec patch and re-serialises the choice url, leaving width/height untouched', () => {
    const spec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };

    // color/opacity stay at their engine defaults, so they're omitted from the rebuilt url.
    expect(regeneratedPanelPatch(spec, { radius: 12 })).toEqual({
      choice: { source: 'url', url: 'panel:w=380,h=150,r=12' },
    });
  });

  it('omits params back to their default form when the patch restores a default', () => {
    const spec = { width: 500, height: 220, radius: 10, color: '0a0f14', opacity: 0.72 };

    expect(regeneratedPanelPatch(spec, { radius: 24 })).toEqual({
      choice: { source: 'url', url: 'panel:w=500,h=220' },
    });
  });

  it('patches color and opacity independently', () => {
    const spec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };

    // opacity 0.72 is the engine default, so it stays omitted once color diverges.
    expect(regeneratedPanelPatch(spec, { color: 'ff00aa' })).toEqual({
      choice: { source: 'url', url: 'panel:w=380,h=150,r=28,c=ff00aa' },
    });
    expect(regeneratedPanelPatch(spec, { opacity: 0.4 })).toEqual({
      choice: { source: 'url', url: 'panel:w=380,h=150,r=28,o=0.4' },
    });
  });
});
