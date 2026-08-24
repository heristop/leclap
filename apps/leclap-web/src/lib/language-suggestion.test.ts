import { describe, expect, it } from 'vitest';

import { composeOffer, nativeName, offerCopyLanguage, pickSuggestedLanguage } from './language-suggestion';

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

describe('composeOffer', () => {
  it('fills each slot with its language name and tags it with that language', () => {
    expect(composeOffer('Read it in <to/>?', 'en', 'fr')).toEqual([
      { text: 'Read it in ', lang: null },
      { text: 'Français', lang: 'fr' },
      { text: '?', lang: null },
    ]);
  });

  // The whole point of naming the slots rather than splitting a template: German holds its verb
  // back, so neither name sits where the English sentence puts it — and the two names still have to
  // be told apart, because each is a word in a different language.
  it('tags both names separately wherever the grammar puts them', () => {
    expect(composeOffer('Du liest auf <from/>. Lieber auf <to/> lesen?', 'en', 'de')).toEqual([
      { text: 'Du liest auf ', lang: null },
      { text: 'English', lang: 'en' },
      { text: '. Lieber auf ', lang: null },
      { text: 'Deutsch', lang: 'de' },
      { text: ' lesen?', lang: null },
    ]);
  });

  // A sentence naming the language being read inside the language being offered is exactly the case
  // one card-level `lang` gets wrong: two languages, one attribute, one of them mispronounced.
  it('never gives the two names the same language', () => {
    const tagged = composeOffer('Tu lis ce site en <from/>. Le lire en <to/> ?', 'en', 'fr')
      .filter((run) => run.lang !== null)
      .map((run) => run.lang);

    expect(tagged).toEqual(['en', 'fr']);
  });

  it('returns one plain run for a sentence with no slots', () => {
    expect(composeOffer('Plain sentence.', 'en', 'fr')).toEqual([{ text: 'Plain sentence.', lang: null }]);
  });

  // An empty run would render an empty <strong> or <span> for nothing.
  it('drops zero-length runs at the edges', () => {
    expect(composeOffer('<to/>', 'en', 'fr')).toEqual([{ text: 'Français', lang: 'fr' }]);
  });

  // A mistyped marker stays visible rather than swallowing the rest of the sentence.
  it('leaves an unknown marker as plain text', () => {
    expect(composeOffer('Lire en <fro/>.', 'en', 'fr')).toEqual([{ text: 'Lire en <fro/>.', lang: null }]);
  });

  it('has nothing to split in an empty string', () => {
    expect(composeOffer('', 'en', 'fr')).toEqual([]);
  });
});

describe('offerCopyLanguage', () => {
  it('labels the card with the offered language once its copy has loaded', () => {
    expect(offerCopyLanguage('fr', true)).toBe('fr');
  });

  // The failure this exists for: `getFixedT` falls through to English when the chunk never arrived,
  // so the card is English prose — labelling it `lang="fr"` has a French synthesizer read it aloud.
  it('labels the card English when the offered locale failed to load', () => {
    expect(offerCopyLanguage('fr', false)).toBe('en');
  });
});
