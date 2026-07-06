import { describe, it, expect } from 'vitest';
import { nextCaption } from './CaptionField';

describe('nextCaption', () => {
  it('clears the whole caption when the text is blank', () => {
    expect(nextCaption({ text: 'Hi', position: 'top', style: 'bold' }, { text: '' })).toBeUndefined();
    expect(nextCaption({ text: 'Hi' }, { text: '   ' })).toBeUndefined();
    expect(nextCaption(undefined, { position: 'center' })).toBeUndefined();
  });

  it('preserves the reveal entrance across unrelated edits and writes it via a patch', () => {
    const current = { text: 'Hello', reveal: 'rise' as const };

    // Editing another field must not drop the entrance animation.
    expect(nextCaption(current, { position: 'top' })).toEqual({ text: 'Hello', reveal: 'rise', position: 'top' });

    // The RevealControl writes the full timing object once any timing is overridden.
    expect(nextCaption(current, { reveal: { type: 'fade', delay: 0.5 } })).toEqual({
      text: 'Hello',
      reveal: { type: 'fade', delay: 0.5 },
    });

    // Selecting "none" clears the entrance but keeps the caption.
    expect(nextCaption(current, { reveal: undefined })).toEqual({ text: 'Hello', reveal: undefined });
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
