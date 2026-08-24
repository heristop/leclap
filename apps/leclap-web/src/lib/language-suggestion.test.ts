import { describe, expect, it } from 'vitest';

import { nativeName, pickSuggestedLanguage, splitEmphasis } from './language-suggestion';

describe('pickSuggestedLanguage', () => {
  it('offers the browser language when it differs from the one being read', () => {
    expect(pickSuggestedLanguage(['fr-FR', 'en-US'], 'en', false, null)).toBe('fr');
  });

  it('offers nothing when the top shipped preference is already active', () => {
    expect(pickSuggestedLanguage(['fr-FR'], 'fr', false, null)).toBeNull();
  });

  it('honours the visitor preference order, not our locale order', () => {
    expect(pickSuggestedLanguage(['ja', 'pt-BR', 'de-AT', 'fr'], 'en', false, null)).toBe('de');
  });

  it('ignores languages we do not ship', () => {
    expect(pickSuggestedLanguage(['ja', 'ko'], 'en', false, null)).toBeNull();
  });

  it('matches on the base language, case-insensitively', () => {
    expect(pickSuggestedLanguage(['ES-419'], 'en', false, null)).toBe('es');
  });

  it('stays silent once dismissed', () => {
    expect(pickSuggestedLanguage(['fr-FR'], 'en', true, null)).toBeNull();
  });

  it('stays silent when the visitor already chose a language explicitly', () => {
    expect(pickSuggestedLanguage(['fr-FR'], 'en', false, 'en')).toBeNull();
  });

  // A leftover from a retired locale, or junk written by anything else, must not silence the offer
  // for good.
  it('ignores a stored value that is not a language we ship', () => {
    expect(pickSuggestedLanguage(['fr-FR'], 'en', false, 'klingon')).toBe('fr');
  });

  it('ignores an empty stored value', () => {
    expect(pickSuggestedLanguage(['fr-FR'], 'en', false, '')).toBe('fr');
  });

  it('offers nothing for an empty preference list', () => {
    expect(pickSuggestedLanguage([], 'en', false, null)).toBeNull();
  });
});

describe('nativeName', () => {
  it('names each language the way its own speakers write it', () => {
    expect(nativeName('en')).toBe('English');
    expect(nativeName('fr')).toBe('Français');
    expect(nativeName('de')).toBe('Deutsch');
    expect(nativeName('es')).toBe('Español');
    expect(nativeName('it')).toBe('Italiano');
  });
});

describe('splitEmphasis', () => {
  it('marks the text between the markers and leaves the rest plain', () => {
    expect(splitEmphasis('Read it in <em>Français</em>?')).toEqual([
      { text: 'Read it in ', emphasis: false },
      { text: 'Français', emphasis: true },
      { text: '?', emphasis: false },
    ]);
  });

  // The whole point of marking the names in the copy rather than splitting a template: German holds
  // its verb back, so neither name sits where the English sentence puts it.
  it('handles two marked names wherever the grammar puts them', () => {
    expect(splitEmphasis('Du liest auf <em>English</em>. Lieber auf <em>Deutsch</em> lesen?')).toEqual([
      { text: 'Du liest auf ', emphasis: false },
      { text: 'English', emphasis: true },
      { text: '. Lieber auf ', emphasis: false },
      { text: 'Deutsch', emphasis: true },
      { text: ' lesen?', emphasis: false },
    ]);
  });

  it('returns one plain run for a sentence with no markers', () => {
    expect(splitEmphasis('Plain sentence.')).toEqual([{ text: 'Plain sentence.', emphasis: false }]);
  });

  // An empty run would render an empty <strong> or <span> for nothing.
  it('drops zero-length runs at the edges', () => {
    expect(splitEmphasis('<em>Français</em>')).toEqual([{ text: 'Français', emphasis: true }]);
  });

  it('emphasises the remainder when a marker is never closed, rather than dropping it', () => {
    expect(splitEmphasis('Lire en <em>Français')).toEqual([
      { text: 'Lire en ', emphasis: false },
      { text: 'Français', emphasis: true },
    ]);
  });

  it('has nothing to split in an empty string', () => {
    expect(splitEmphasis('')).toEqual([]);
  });
});
