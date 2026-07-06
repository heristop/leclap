import { describe, it, expect } from 'vitest';
import type { GlobalTextOverlay } from '../templateEditorModel';
import { overlayDisplayText, withOverlayText } from './global-overlay-text';

describe('overlayDisplayText', () => {
  it('prefers the English translation', () => {
    expect(overlayDisplayText({ en: '#brand', fr: '#marque' })).toBe('#brand');
  });

  it('falls back to the first non-empty translation when English is absent', () => {
    expect(overlayDisplayText({ fr: '#marque' })).toBe('#marque');
  });

  it('skips empty translations when falling back', () => {
    expect(overlayDisplayText({ fr: '', de: '#marke' })).toBe('#marke');
  });

  it('returns an empty string for an empty map', () => {
    expect(overlayDisplayText({})).toBe('');
  });
});

describe('withOverlayText', () => {
  const overlay: GlobalTextOverlay = {
    text: { en: '#brand', fr: '#marque', de: '#marke' },
    position: 'bottom-right',
    color: '#ff0000',
  };

  it('updates the English text without clobbering the other locales', () => {
    expect(withOverlayText(overlay, '#rebrand').text).toEqual({ en: '#rebrand', fr: '#marque', de: '#marke' });
  });

  it('keeps the overlay styling fields untouched', () => {
    expect(withOverlayText(overlay, '#rebrand')).toMatchObject({ position: 'bottom-right', color: '#ff0000' });
  });

  it('does not mutate the original overlay', () => {
    withOverlayText(overlay, '#rebrand');

    expect(overlay.text).toEqual({ en: '#brand', fr: '#marque', de: '#marke' });
  });

  it('adds the English key to a map that never had one', () => {
    expect(withOverlayText({ text: { it: '#marchio' } }, 'hello').text).toEqual({ it: '#marchio', en: 'hello' });
  });
});
