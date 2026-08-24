// The suggestion card composes one sentence out of two language names, in whichever of the five
// languages is being offered — twenty from→to pairs, none of which the type checker can look at,
// because the names are data and the sentence is a translation string.
//
// Three things can break silently here and all three are checked below:
//   • a translator drops one of the `<from/>` / `<to/>` slots, and the sentence quietly stops naming
//     a language;
//   • a slot is mistyped, so the name is never substituted and the raw marker ships as visible text;
//   • the offered locale's bundle is not loaded when `getFixedT` reads it, and i18next answers from
//     the English fallback — so the card offers French *in English*, which is the one thing the
//     feature exists not to do. That is why every case awaits `loadLanguages` first, exactly as the
//     component does.
//
// The sentence holds words from two languages at once, so each name has to come back tagged with its
// own language: one card-level `lang` would have a French synthesizer pronounce "English".
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from '@/i18n';
import { LOCALE_CODES, type Language } from '@/config/site';
import { composeOffer, nativeName, resolveOfferCopy, type SentenceRun } from './language-suggestion';
import { en } from '@/i18n/locales/en';
import { fr } from '@/i18n/locales/fr';
import { de } from '@/i18n/locales/de';
import { es } from '@/i18n/locales/es';
import { it as itLocale } from '@/i18n/locales/it';

/** Narrow to the runs that are a language name, so `lang` is a Language rather than possibly null. */
const isNamed = (run: SentenceRun): run is SentenceRun & { lang: Language } => run.lang !== null;

/** Every ordered pair of shipped languages — the card is only ever shown when they differ. */
const PAIRS: readonly (readonly [Language, Language])[] = LOCALE_CODES.flatMap((from) =>
  LOCALE_CODES.filter((to) => to !== from).map((to) => [from, to] as const)
);

const offer = async (from: Language, to: Language) => {
  await i18nReady;
  await i18n.loadLanguages(to);

  const t = i18n.getFixedT(to, 'common');

  const sentence = t('languageSuggestion.body');

  return {
    title: t('languageSuggestion.title'),
    sentence,
    runs: composeOffer(sentence, from, to),
    accept: t('languageSuggestion.accept', { language: nativeName(to) }),
  };
};

describe('language suggestion copy', () => {
  it.each(PAIRS)('composes a %s → %s offer that names both languages', async (from, to) => {
    const { runs, sentence } = await offer(from, to);
    const named = runs.filter(isNamed);

    // Both names present, in the order the translator chose — not the order we assume.
    expect(named.map((run) => run.text).sort()).toEqual([nativeName(from), nativeName(to)].sort());
    // Nothing left over in the middle: the runs put the sentence back together with the slots filled.
    expect(runs.map((run) => run.text).join('')).toBe(
      sentence.replace('<from/>', nativeName(from)).replace('<to/>', nativeName(to))
    );
    // A mistyped slot would leave the raw marker in the visible sentence.
    expect(runs.map((run) => run.text).join('')).not.toContain('<');
    // The sentence has to say something around the names, not just be the names.
    expect(runs.filter((run) => run.lang === null).length).toBeGreaterThan(0);
  });

  // The card renders one sentence containing words from two languages. Each name is tagged with the
  // language it is written in, so a screen reader switches voice for it instead of reading "English"
  // through a French synthesizer — the one word that tells the visitor what they are looking at.
  it.each(PAIRS)('tags the %s → %s names with their own languages', async (from, to) => {
    const { runs } = await offer(from, to);
    const tagged = runs.filter(isNamed);

    expect(tagged).toHaveLength(2);
    expect(tagged.map((run) => run.lang).sort()).toEqual([from, to].sort());

    for (const run of tagged) {
      expect(run.text).toBe(nativeName(run.lang));
    }
  });

  it.each(PAIRS)('labels the %s → %s action with the language being offered', async (from, to) => {
    const { accept, title } = await offer(from, to);

    expect(accept).toContain(nativeName(to));
    expect(accept).not.toContain('{{');
    // A verb phrase, not the bare language name — the button says what pressing it does.
    expect(accept.length).toBeGreaterThan(nativeName(to).length);
    expect(title.length).toBeGreaterThan(0);
  });

  // The English bundle is the one loaded at init, so it is also what a missing bundle falls back to.
  // If any of these matched English, the card would be offering a language in a language the visitor
  // just told us they would rather not read.
  it.each(LOCALE_CODES.filter((code) => code !== 'en'))('writes the %s offer in %s, not English', async (to) => {
    const localized = await offer('en', to);
    const english = await offer(to, 'en');

    expect(localized.title).not.toBe(english.title);
    expect(localized.accept).not.toBe(english.accept);
  });
});

// The card's prose is in one language and its two language names are in two others, so `lang` on the
// card describes the prose and nothing else. The bug this pins: the card asked a *load promise*
// whether the offered copy had arrived, and `i18n.loadLanguages()` resolves immediately for a
// language already in `options.preload` — true of every second call in a session, which StrictMode's
// double-invoked effect and any remount both produce. The card painted before the chunk landed, from
// the English fallback, under `lang="fr"`, and never repainted.
//
// So the assertion is not "the French strings exist" (they did) but "the strings and the attribute
// agree" — checked in both load states, because the mislabelled state is the one that only appears
// when they are resolved separately.
describe('resolveOfferCopy', () => {
  /** Read one `common` key in a named language, exactly as the component's adapter does. */
  const read = (lng: Language, key: string, options?: { language: string }) =>
    i18n.getFixedT(lng, 'common')(key, options);

  const bundles = { en, fr, de, es, it: itLocale } as const;

  const copyFor = async (from: Language, to: Language, loaded: boolean) => {
    await i18nReady;
    await i18n.loadLanguages(to);

    return resolveOfferCopy(from, to, loaded, read);
  };

  it.each(PAIRS)('reads the %s → %s copy from the language it labels it with', async (from, to) => {
    const copy = await copyFor(from, to, true);
    const source = bundles[copy.lang].common.languageSuggestion;

    expect(copy.lang).toBe(to);
    expect(copy.title).toBe(source.title);
    expect(copy.region).toBe(source.region);
    expect(copy.dismiss).toBe(source.dismiss);
  });

  // The live failure: the load promise said yes, the store did not have the bundle, and the card was
  // labelled with the offered language while every word in it came from the English fallback. With
  // the answer taken from the store, an absent bundle yields English prose labelled `en` instead.
  it.each(PAIRS)('never labels the %s → %s copy with a language it did not read', async (from, to) => {
    const copy = await copyFor(from, to, false);
    const source = bundles[copy.lang].common.languageSuggestion;

    expect(copy.lang).toBe('en');
    expect(copy.title).toBe(source.title);
    expect(copy.title).toBe(en.common.languageSuggestion.title);
    expect(copy.dismiss).toBe(source.dismiss);
  });

  // Both language names are still tagged individually whichever language the prose came out in — the
  // names are words in their own languages regardless of what the surrounding sentence is written in.
  it.each([true, false])('tags both names when the copy is loaded=%s', async (loaded) => {
    const copy = await copyFor('en', 'fr', loaded);
    const tagged = copy.body.filter(isNamed);

    expect(tagged.map((run) => run.lang).sort()).toEqual(['en', 'fr']);
    expect(tagged.map((run) => run.text).sort()).toEqual([nativeName('en'), nativeName('fr')].sort());
  });
});
