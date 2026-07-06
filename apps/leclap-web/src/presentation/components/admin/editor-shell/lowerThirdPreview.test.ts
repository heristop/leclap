import { describe, it, expect } from 'vitest';
import type { LowerThird } from '../templateEditorModel';
import { lowerThirdPreview } from './lowerThirdPreview';

// 360px preview of the 1280x720 landscape engine frame → every engine px is 0.5 preview px.
const PREVIEW_H = 360;

const lowerThird: LowerThird = {
  title: { en: 'Jane Doe' },
  subtitle: { en: 'Happy customer' },
  accent: '#FDE047',
};

describe('lowerThirdPreview', () => {
  it('returns null for an absent or textless lower third', () => {
    expect(lowerThirdPreview(undefined, PREVIEW_H, 'landscape')).toBeNull();
    expect(lowerThirdPreview({ accent: '#fff', boxOpacity: 1 }, PREVIEW_H, 'landscape')).toBeNull();
    expect(lowerThirdPreview({ title: { en: ' ' } }, PREVIEW_H, 'landscape')).toBeNull();
  });

  it('mirrors the engine bottom band layout (text-blocks.ts lowerThirdToFilters)', () => {
    const preview = lowerThirdPreview(lowerThird, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    // bandH = round(720 * 0.2) = 144, bandY = 720 - 144 = 576
    expect(preview.band).toEqual({ topPx: 288, heightPx: 72, color: '#0a0f14', opacity: 0.6 });
    // bar: x = margin 77, y = 576 + round(720 * 0.04) = 605, w = round(1280 * 0.1) = 128, h = 4
    expect(preview.bar).toEqual({
      x: { side: 'left', px: 38.5 },
      topPx: 302.5,
      widthPx: 64,
      heightPx: 2,
      color: '#FDE047',
    });
    expect(preview.lines).toEqual([
      {
        key: 'title',
        text: 'Jane Doe',
        x: { side: 'left', px: 38.5 },
        y: { edge: 'top', px: 308 }, // 576 + round(720 * 0.055) = 616
        fontPx: 18, // round(720 * 0.05) = 36
        fontFamily: 'Anton',
        color: '#ffffff',
      },
      {
        key: 'subtitle',
        text: 'Happy customer',
        x: { side: 'left', px: 38.5 },
        y: { edge: 'top', px: 333 }, // 576 + round(720 * 0.125) = 666
        fontPx: 10, // round(720 * 0.028) = 20
        fontFamily: 'Oswald',
        color: '#c9d0f5',
      },
    ]);
  });

  it('drops the band at boxOpacity 0 and honours a custom opacity', () => {
    expect(lowerThirdPreview({ ...lowerThird, boxOpacity: 0 }, PREVIEW_H, 'landscape')?.band).toBeNull();
    expect(lowerThirdPreview({ ...lowerThird, boxOpacity: 0.3 }, PREVIEW_H, 'landscape')?.band?.opacity).toBe(0.3);
  });

  it('anchors the band and lines to the top when position is top', () => {
    const preview = lowerThirdPreview({ ...lowerThird, position: 'top' }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.band?.topPx).toBe(0);
    expect(preview.lines[0].y).toEqual({ edge: 'top', px: 20 }); // 0 + round(720 * 0.055) = 40
  });

  it('renders the badge as a right-aligned accent pill', () => {
    const preview = lowerThirdPreview({ ...lowerThird, badge: { en: '€29' } }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.lines.at(-1)).toEqual({
      key: 'badge',
      text: '€29',
      x: { side: 'right', px: 38.5 },
      y: { edge: 'top', px: 308 },
      fontPx: 14.5, // round(720 * 0.04) = 29
      fontFamily: 'Anton',
      color: '#0a0f14', // dark text on the accent pill
      box: { color: '#FDE047', opacity: 1, paddingPx: 5 }, // max(8, round(720 * 0.014)) = 10
    });
  });

  it('carries the effect onto the title and subtitle but not the badge (engine badgePill has none)', () => {
    const effect = { outline: true as const };
    const preview = lowerThirdPreview({ ...lowerThird, badge: { en: '€29' }, effect }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.lines.find((line) => line.key === 'title')?.effect).toEqual(effect);
    expect(preview.lines.find((line) => line.key === 'subtitle')?.effect).toEqual(effect);
    expect(preview.lines.find((line) => line.key === 'badge')?.effect).toBeUndefined();
  });

  it('falls back to the default badge pill colour without an accent', () => {
    const preview = lowerThirdPreview({ badge: { en: 'Step 1' } }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    const badge = preview.lines.at(-1);
    expect(badge?.color).toBe('#ffffff');
    expect(badge?.box?.color).toBe('#7C83FF');
    expect(preview.bar).toBeNull();
  });
});
