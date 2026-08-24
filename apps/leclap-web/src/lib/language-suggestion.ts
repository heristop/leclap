import { LOCALES, LOCALE_CODES, type Language } from '@/config/site';

/** Where a dismissed suggestion is remembered, so the banner is offered once and not on every visit. */
export const SUGGESTION_DISMISSED_KEY = 'leclap-lang-suggested';

/**
 * Which shipped language the visitor's browser would rather read, or `null` if there is nothing
 * worth offering. Pure: the caller supplies the browser list and the active language, so this is
 * testable without a DOM.
 *
 * Order matters — `navigator.languages` is the visitor's own preference ranking, so the first entry
 * that matches a language we ship wins, not the first language we happen to ship.
 */
export function pickSuggestedLanguage(
  preferred: readonly string[],
  current: Language,
  dismissed: boolean,
  stored: string | null
): Language | null {
  // An explicit pick in the switcher settles the question for good; so does dismissing the banner.
  // Only a value we still ship counts — a leftover from a retired locale, or junk written by
  // anything else, must not silence the offer forever.
  if (dismissed || (stored !== null && LOCALE_CODES.includes(stored as Language))) {
    return null;
  }

  for (const entry of preferred) {
    const base = entry.split('-')[0].toLowerCase();

    if (!LOCALE_CODES.includes(base as Language)) {
      continue;
    }

    // Their top shipped preference is what they're already reading — nothing to offer.
    return base === current ? null : (base as Language);
  }

  return null;
}

// Endonym lookup, mirroring the OG_LOCALE table in config/site.ts. The suggestion card names both
// languages inside one sentence, so it needs the name for an arbitrary code — LOCALES is an array,
// and a `.find()` per render at two call sites is a lookup written out longhand.
const ENDONYM = Object.fromEntries(LOCALES.map((l) => [l.code, l.nativeName])) as Record<Language, string>;

/**
 * How speakers of `lng` write the name of their own language ("Deutsch", not "German"). The card is
 * rendered entirely in the language being offered, so both names in its sentence are endonyms — a
 * German visitor on the English site reads "auf English", not "auf Englisch". That is deliberate:
 * the name in the sentence is the same word that labels the language in the header picker.
 */
export const nativeName = (lng: Language): string => ENDONYM[lng];

/** One stretch of the offer sentence — `emphasis` marks a language name, drawn stronger than the rest. */
export type SentenceRun = { readonly text: string; readonly emphasis: boolean };

// `<em>` is a marker in the copy, not markup we ever hand to a parser: the runs below are rendered
// as React children, so a translation can never inject HTML. Splitting on the tag rather than
// matching pairs means the runs simply alternate — plain, emphasised, plain — and an unclosed marker
// degrades to "emphasise the rest of the sentence" instead of silently dropping it.
const MARKER = /<\/?em>/;

/**
 * Split a translated sentence into plain and emphasised runs at its `<em>` markers.
 *
 * The card bolds the two language names inside a sentence whose word order changes per language —
 * German puts the verb last, so neither name sits at a fixed position and a "prefix + name + suffix"
 * split cannot work. Marking the names in the copy itself lets each translator put them wherever the
 * grammar wants them.
 *
 * `<Trans>` would do the same job, but nothing else in this app uses it, and it would mean teaching
 * one more i18next mechanism for a single sentence. Runs are plain data: pure, node-testable, and
 * rendered as text nodes rather than parsed as markup.
 *
 * Zero-length runs are dropped — a sentence that opens on `<em>` yields no empty `<span>` in the DOM.
 */
export function splitEmphasis(sentence: string): SentenceRun[] {
  return sentence
    .split(MARKER)
    .map((text, index) => ({ text, emphasis: index % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}
