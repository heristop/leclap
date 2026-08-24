// The suggestion card composes one sentence out of two language names, in whichever of the five
// languages is being offered — twenty from→to pairs, none of which the type checker can look at,
// because the names are data and the sentence is a translation string.
//
// Three things can break silently here and all three are checked below:
//   • a translator drops one of the `{{from}}` / `{{to}}` placeholders, and the sentence quietly
//     stops naming a language;
//   • a translator drops one of the `<em>` markers, and the names stop being marked — or worse, an
//     unbalanced marker emphasises the rest of the paragraph;
//   • the offered locale's bundle is not loaded when `getFixedT` reads it, and i18next answers from
//     the English fallback — so the card offers French *in English*, which is the one thing the
//     feature exists not to do. That is why every case awaits `loadLanguages` first, exactly as the
//     component does.
import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from '@/i18n';
import { LOCALE_CODES, type Language } from '@/config/site';
import { nativeName, splitEmphasis } from './language-suggestion';

/** Every ordered pair of shipped languages — the card is only ever shown when they differ. */
const PAIRS: readonly (readonly [Language, Language])[] = LOCALE_CODES.flatMap((from) =>
  LOCALE_CODES.filter((to) => to !== from).map((to) => [from, to] as const)
);

const offer = async (from: Language, to: Language) => {
  await i18nReady;
  await i18n.loadLanguages(to);

  const t = i18n.getFixedT(to, 'common');

  return {
    title: t('languageSuggestion.title'),
    body: t('languageSuggestion.body', { from: nativeName(from), to: nativeName(to) }),
    accept: t('languageSuggestion.accept', { language: nativeName(to) }),
  };
};

describe('language suggestion copy', () => {
  it.each(PAIRS)('composes a %s → %s offer that names both languages', async (from, to) => {
    const { body } = await offer(from, to);
    const runs = splitEmphasis(body);

    // Both names present, marked, and in the order the translator chose — not the order we assume.
    expect(
      runs
        .filter((run) => run.emphasis)
        .map((run) => run.text)
        .sort()
    ).toEqual([nativeName(from), nativeName(to)].sort());
    // Nothing left unmarked in the middle: the runs put the sentence back together verbatim.
    expect(runs.map((run) => run.text).join('')).toBe(body.replaceAll(/<\/?em>/g, ''));
    // A dropped placeholder would leave the raw handlebars in the visible sentence.
    expect(body).not.toContain('{{');
    // The sentence has to say something around the names, not just be the names.
    expect(runs.filter((run) => !run.emphasis).length).toBeGreaterThan(0);
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
