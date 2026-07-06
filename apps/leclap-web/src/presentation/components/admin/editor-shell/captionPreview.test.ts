import { describe, it, expect } from 'vitest';
import type { EditorCaption } from '../templateEditorModel';
import { captionPreview } from './captionPreview';

// 360px preview of the 1280x720 landscape engine frame → every engine px is 0.5 preview px. The
// caption preset constants (fontsize 46, offsets 60/110, margin 80, border 18) are absolute engine px.
const PREVIEW_H = 360;

describe('captionPreview', () => {
  it('returns null for an absent or blank caption', () => {
    expect(captionPreview(undefined, PREVIEW_H, 'landscape')).toBeNull();
    expect(captionPreview({ text: '   ' }, PREVIEW_H, 'landscape')).toBeNull();
  });

  it('mirrors the default bar / lower-third / center preset (captions.ts)', () => {
    expect(captionPreview({ text: 'Hello' }, PREVIEW_H, 'landscape')).toEqual({
      key: 'caption',
      text: 'Hello',
      x: { side: 'center' },
      y: { edge: 'bottom', px: 55 }, // lower-third: (h-text_h)-110
      fontPx: 23, // bar preset 46
      fontFamily: 'Oswald',
      color: '#f5f5f0',
      box: { color: '#141416', opacity: 0.8, paddingPx: 9 }, // #141416@0.8, boxborderw 18
    });
  });

  it('maps every position preset to its engine anchor', () => {
    const at = (position: EditorCaption['position']) =>
      captionPreview({ text: 'Hi', position }, PREVIEW_H, 'landscape')?.y;

    expect(at('top')).toEqual({ edge: 'top', px: 30 }); // y = 60
    expect(at('center')).toEqual({ edge: 'center' });
    expect(at('bottom')).toEqual({ edge: 'bottom', px: 30 }); // (h-text_h)-60
    expect(at('lower-third')).toEqual({ edge: 'bottom', px: 55 });
  });

  it('maps left/right alignment to the 80px engine margin', () => {
    const at = (align: EditorCaption['align']) => captionPreview({ text: 'Hi', align }, PREVIEW_H, 'landscape')?.x;

    expect(at('left')).toEqual({ side: 'left', px: 40 });
    expect(at('right')).toEqual({ side: 'right', px: 40 });
  });

  it('applies the subtle and bold presets without a box', () => {
    const subtle = captionPreview({ text: 'Hi', style: 'subtle' }, PREVIEW_H, 'landscape');
    const bold = captionPreview({ text: 'Hi', style: 'bold' }, PREVIEW_H, 'landscape');

    expect(subtle).toMatchObject({ fontPx: 22, fontFamily: 'Rubik', color: '#ffffff' });
    expect(subtle?.box).toBeUndefined();
    expect(bold).toMatchObject({ fontPx: 36, fontFamily: 'Bebas Neue', color: '#ffffff' });
  });

  it('honours font, size and colour overrides', () => {
    const caption: EditorCaption = { text: 'Hi', font: 'anton', fontsize: 60, color: '#FDE047' };

    expect(captionPreview(caption, PREVIEW_H, 'landscape')).toMatchObject({
      fontPx: 30,
      fontFamily: 'Anton',
      color: '#FDE047',
    });
    // A raw .ttf filename resolves through the registry; an unknown id keeps the preset font.
    expect(captionPreview({ text: 'Hi', font: 'Anton.ttf' }, PREVIEW_H, 'landscape')?.fontFamily).toBe('Anton');
    expect(captionPreview({ text: 'Hi', font: 'nope' }, PREVIEW_H, 'landscape')?.fontFamily).toBe('Oswald');
  });

  it('mirrors the engine box override matrix (captions.ts resolveBox)', () => {
    // box off on a boxed preset
    expect(captionPreview({ text: 'Hi', box: false }, PREVIEW_H, 'landscape')?.box).toBeUndefined();
    // box on for a boxless preset → engine default #000000@0.8
    expect(captionPreview({ text: 'Hi', style: 'subtle', box: true }, PREVIEW_H, 'landscape')?.box).toEqual({
      color: '#000000',
      opacity: 0.8,
      paddingPx: 9,
    });
    // explicit colour/opacity overrides rebuild the token even on the bar preset
    expect(captionPreview({ text: 'Hi', boxColor: '#112233', boxOpacity: 0.5 }, PREVIEW_H, 'landscape')?.box).toEqual({
      color: '#112233',
      opacity: 0.5,
      paddingPx: 9,
    });
  });

  it('carries the caption effect onto the line', () => {
    const effect = { shadow: { dx: 4, dy: 4 } };

    expect(captionPreview({ text: 'Hi', effect }, PREVIEW_H, 'landscape')?.effect).toEqual(effect);
    expect(captionPreview({ text: 'Hi' }, PREVIEW_H, 'landscape')?.effect).toBeUndefined();
  });

  it('scales the fixed px constants against the portrait 1280px-high frame', () => {
    // previewH 640 → factor 0.5 against the portrait frame height.
    const preview = captionPreview({ text: 'Hi' }, 640, 'portrait');

    expect(preview?.fontPx).toBe(23);
    expect(preview?.y).toEqual({ edge: 'bottom', px: 55 });
  });
});
