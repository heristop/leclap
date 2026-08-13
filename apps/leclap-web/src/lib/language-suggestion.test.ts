import { describe, expect, it } from 'vitest';

import { pickSuggestedLanguage } from './language-suggestion';

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
