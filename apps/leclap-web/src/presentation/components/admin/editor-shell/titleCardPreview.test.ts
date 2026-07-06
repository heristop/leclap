import { describe, it, expect } from 'vitest';
import type { TitleCard } from '../templateEditorModel';
import { titleCardPreview } from './titleCardPreview';

// The engine renders landscape at 1280x720 (default.config.ts SCALE); previewing at 360px high
// means every engine px maps to exactly 0.5 preview px, keeping the expected values readable.
const PREVIEW_H = 360;

const card: TitleCard = {
  kicker: { en: 'Introducing' },
  headline: { en: 'Your headline here' },
  subtitle: { en: 'A short supporting line' },
  accent: '#7C83FD',
};

describe('titleCardPreview', () => {
  it('returns null for an absent or textless card', () => {
    expect(titleCardPreview(undefined, PREVIEW_H, 'landscape')).toBeNull();
    expect(titleCardPreview({ accent: '#fff' }, PREVIEW_H, 'landscape')).toBeNull();
    expect(titleCardPreview({ headline: { en: '   ' } }, PREVIEW_H, 'landscape')).toBeNull();
  });

  it('mirrors the engine landscape layout (text-blocks.ts titleCardToFilters)', () => {
    const preview = titleCardPreview(card, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    // margin = round(1280 * 0.06) = 77 engine px → 38.5 preview px
    expect(preview.lines).toEqual([
      {
        key: 'kicker',
        text: 'Introducing',
        x: { side: 'left', px: 38.5 },
        y: { edge: 'top', px: 144 }, // round(720 * 0.4) = 288
        fontPx: 9.5, // round(720 * 0.026) = 19
        fontFamily: 'Oswald',
        color: '#7C83FD', // accent tints the kicker
      },
      {
        key: 'headline',
        text: 'Your headline here',
        x: { side: 'left', px: 38.5 },
        y: { edge: 'top', px: 162.5 }, // round(720 * 0.452) = 325
        fontPx: 30.5, // round(720 * 0.085) = 61
        fontFamily: 'Anton',
        color: '#ffffff',
      },
      {
        key: 'subtitle',
        text: 'A short supporting line',
        x: { side: 'left', px: 38.5 },
        y: { edge: 'top', px: 227 }, // round(720 * 0.63) = 454
        fontPx: 11, // round(720 * 0.03) = 22
        fontFamily: 'Oswald',
        color: '#cfd3de',
      },
    ]);
    expect(preview.bar).toEqual({
      x: { side: 'left', px: 38.5 },
      topPx: 210.5, // round(720 * 0.585) = 421
      widthPx: 83, // round(1280 * 0.13) = 166
      heightPx: 2, // max(4, round(720 * 0.006)) = 4
      color: '#7C83FD',
    });
  });

  it('centers every line and the bar when align is center', () => {
    const preview = titleCardPreview({ ...card, align: 'center' }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.lines.map((line) => line.x)).toEqual([{ side: 'center' }, { side: 'center' }, { side: 'center' }]);
    expect(preview.bar?.x).toEqual({ side: 'center' });
  });

  it('renders a white kicker and no bar without an accent', () => {
    const preview = titleCardPreview({ kicker: { en: 'Hi' }, headline: { en: 'Yo' } }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.lines[0].color).toBe('#ffffff');
    expect(preview.bar).toBeNull();
  });

  it('skips empty lines but keeps the accent bar', () => {
    const preview = titleCardPreview({ headline: { en: 'Solo' }, accent: '#FDE047' }, PREVIEW_H, 'landscape');

    if (!preview) throw new Error('expected a preview');
    expect(preview.lines.map((line) => line.key)).toEqual(['headline']);
    expect(preview.bar?.color).toBe('#FDE047');
  });

  it('derives geometry from the portrait 720x1280 frame', () => {
    // previewH 640 → factor 0.5 against the 1280px-high portrait frame.
    const preview = titleCardPreview(card, 640, 'portrait');

    if (!preview) throw new Error('expected a preview');
    // margin = round(720 * 0.06) = 43 engine px → 21.5 preview px
    expect(preview.lines[0].x).toEqual({ side: 'left', px: 21.5 });
    expect(preview.lines[1].fontPx).toBe(54.5); // round(1280 * 0.085) = 109
  });

  it('falls back to the first translated value when there is no english line', () => {
    const preview = titleCardPreview({ headline: { fr: 'Salut' } }, PREVIEW_H, 'landscape');

    expect(preview?.lines[0].text).toBe('Salut');
  });

  it('carries the card effect onto every line (the engine applies it per pushLine)', () => {
    const effect = { shadow: true as const };
    const preview = titleCardPreview({ ...card, effect }, PREVIEW_H, 'landscape');

    expect(preview?.lines.map((line) => line.effect)).toEqual([effect, effect, effect]);
    expect(titleCardPreview(card, PREVIEW_H, 'landscape')?.lines[0].effect).toBeUndefined();
  });
});
