import { describe, it, expect } from 'vitest';
import type { EditorCaption, LowerThird, TitleCard } from '../templateEditorModel';
import {
  commitSugarLine,
  snapCaptionPosition,
  snapLowerThirdPosition,
  snapTitleCardAlign,
  sugarDragPatch,
  sugarLineKeys,
  sugarLineText,
} from './sugarCanvasEditing';

describe('sugarLineKeys / sugarLineText', () => {
  it('exposes the editable lines per kind, in draw order', () => {
    expect(sugarLineKeys('titleCard')).toEqual(['kicker', 'headline', 'subtitle']);
    expect(sugarLineKeys('lowerThird')).toEqual(['title', 'subtitle', 'badge']);
    expect(sugarLineKeys('caption')).toEqual(['caption']);
  });

  it('reads the current text of a line', () => {
    const card: TitleCard = { headline: { en: 'Big' } };

    expect(sugarLineText('titleCard', card, 'headline')).toBe('Big');
    expect(sugarLineText('titleCard', card, 'kicker')).toBe('');
    expect(sugarLineText('caption', { text: 'Sub' } as EditorCaption, 'caption')).toBe('Sub');
    expect(sugarLineText('lowerThird', { title: { en: 'Jane' } } as LowerThird, 'title')).toBe('Jane');
  });
});

describe('commitSugarLine', () => {
  it('writes a titleCard line as an { en } record and keeps the rest', () => {
    const card: TitleCard = { kicker: { en: 'Now' }, headline: { en: 'Old' }, accent: '#fff' };
    const next = commitSugarLine('titleCard', card, 'headline', 'New headline') as TitleCard;

    expect(next.headline).toEqual({ en: 'New headline' });
    expect(next.kicker).toEqual({ en: 'Now' });
    expect(next.accent).toBe('#fff');
  });

  it('clears a titleCard line on blank text and the whole card when no line remains', () => {
    const card: TitleCard = { kicker: { en: 'Now' }, headline: { en: 'Old' } };
    const next = commitSugarLine('titleCard', card, 'headline', '  ') as TitleCard;

    expect(next.headline).toBeUndefined();
    expect(next.kicker).toEqual({ en: 'Now' });

    expect(commitSugarLine('titleCard', { headline: { en: 'Old' } }, 'headline', '')).toBeUndefined();
  });

  it('writes the caption text and clears the caption when blank', () => {
    const caption: EditorCaption = { text: 'Old', style: 'bold' };
    const next = commitSugarLine('caption', caption, 'caption', 'New') as EditorCaption;

    expect(next).toEqual({ text: 'New', style: 'bold' });
    expect(commitSugarLine('caption', caption, 'caption', ' ')).toBeUndefined();
  });

  it('writes lowerThird lines and clears the block when the last one empties', () => {
    const third: LowerThird = { title: { en: 'Jane' }, badge: { en: '€9' } };
    const next = commitSugarLine('lowerThird', third, 'badge', '€19') as LowerThird;

    expect(next.badge).toEqual({ en: '€19' });
    expect(next.title).toEqual({ en: 'Jane' });

    const cleared = commitSugarLine('lowerThird', { title: { en: 'Jane' } }, 'title', '');
    expect(cleared).toBeUndefined();
  });
});

describe('snap helpers', () => {
  it('snaps the caption to the nearest engine position slot', () => {
    expect(snapCaptionPosition(0.05)).toBe('top');
    expect(snapCaptionPosition(0.45)).toBe('center');
    expect(snapCaptionPosition(0.75)).toBe('lower-third');
    expect(snapCaptionPosition(0.95)).toBe('bottom');
  });

  it('snaps the lower third to top or bottom around the frame middle', () => {
    expect(snapLowerThirdPosition(0.2)).toBe('top');
    expect(snapLowerThirdPosition(0.8)).toBe('bottom');
  });

  it('snaps the title card to left or center', () => {
    expect(snapTitleCardAlign(0.1)).toBe('left');
    expect(snapTitleCardAlign(0.6)).toBe('center');
  });
});

describe('sugarDragPatch', () => {
  it('patches the caption position from the drop point', () => {
    const caption: EditorCaption = { text: 'Sub' };

    expect(sugarDragPatch('caption', caption, { x: 0.5, y: 0.06 })).toEqual({ text: 'Sub', position: 'top' });
  });

  it('patches the lowerThird position from the drop point', () => {
    const third: LowerThird = { title: { en: 'Jane' } };

    expect(sugarDragPatch('lowerThird', third, { x: 0.5, y: 0.1 })).toEqual({
      title: { en: 'Jane' },
      position: 'top',
    });
  });

  it('patches the titleCard align from the drop point', () => {
    const card: TitleCard = { headline: { en: 'Big' } };

    expect(sugarDragPatch('titleCard', card, { x: 0.9, y: 0.5 })).toEqual({
      headline: { en: 'Big' },
      align: 'center',
    });
    expect(sugarDragPatch('titleCard', card, { x: 0.05, y: 0.5 })).toEqual({
      headline: { en: 'Big' },
      align: 'left',
    });
  });
});
