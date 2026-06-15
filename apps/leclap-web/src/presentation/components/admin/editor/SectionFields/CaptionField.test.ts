import { describe, it, expect } from 'vitest';
import { nextCaption } from './CaptionField';

describe('nextCaption', () => {
  it('clears the whole caption when the text is blank', () => {
    expect(nextCaption({ text: 'Hi', position: 'top', style: 'bold' }, { text: '' })).toBeUndefined();
    expect(nextCaption({ text: 'Hi' }, { text: '   ' })).toBeUndefined();
    expect(nextCaption(undefined, { position: 'center' })).toBeUndefined();
  });

  it('merges the patch over the existing caption, preserving the textI18n stash', () => {
    const current = {
      text: 'Hello',
      textI18n: { en: 'Hello', fr: 'Bonjour' },
      position: 'lower-third' as const,
      style: 'bar' as const,
    };

    expect(nextCaption(current, { text: 'Hi' })).toEqual({
      text: 'Hi',
      textI18n: { en: 'Hello', fr: 'Bonjour' },
      position: 'lower-third',
      style: 'bar',
    });

    expect(nextCaption(current, { position: 'top' })).toEqual({
      text: 'Hello',
      textI18n: { en: 'Hello', fr: 'Bonjour' },
      position: 'top',
      style: 'bar',
    });
  });
});
