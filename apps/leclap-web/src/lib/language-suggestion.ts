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

/**
 * The language the card's prose is actually written in. `getFixedT` reads the loaded store rather
 * than filling it, so a bundle that is not in the store yet leaves i18next answering from the English
 * fallback — and English prose must never be labelled `lang="fr"`. Labelling the card with the
 * language it is genuinely written in is the whole point of the attribute.
 *
 * `loaded` must be answered by the resource store, never by a load promise: `i18n.loadLanguages()`
 * resolves immediately for any language already in `options.preload`, which a second call in the same
 * session always is — so the promise can report success while the bundle is still in flight.
 */
export const offerCopyLanguage = (suggested: Language, loaded: boolean): Language => (loaded ? suggested : 'en');

/**
 * One stretch of the offer sentence. `lang` is set on the runs that are a language *name*, because a
 * name is a word in its own language, not in the sentence's: "English" inside a French sentence is an
 * English word, and a French synthesiser reading it aloud garbles the one word that tells the visitor
 * which language they are currently reading. `null` marks the surrounding prose, which is in the
 * sentence's own language and inherits it from the card.
 */
export type SentenceRun = { readonly text: string; readonly lang: Language | null };

// Slot markers rather than `<em>{{from}}</em>`: with a single marker and interpolated values, the two
// names come out of the split indistinguishable — word order is the translator's, so position cannot
// tell them apart — and neither can be given its own `lang`. Naming the slot in the copy carries that
// through. Splitting on a capturing group makes the runs simply alternate (prose, slot, prose), so an
// unknown or malformed marker degrades to visible text rather than silently dropping a name.
const SLOT = /<(from|to)\/>/;

/**
 * Compose the offer sentence out of its translated prose and the two language names.
 *
 * The card names both languages inside a sentence whose word order changes per language — German
 * holds its verb back, so neither name sits at a fixed position and a "prefix + name + suffix" split
 * cannot work. The translator places `<from/>` and `<to/>` wherever the grammar wants them.
 *
 * `<Trans>` would do the same job, but nothing else in this app uses it, and it would mean teaching
 * one more i18next mechanism for a single sentence. Runs are plain data: pure, node-testable, and
 * rendered as text nodes rather than parsed as markup, so a translation can never inject HTML.
 *
 * Zero-length runs are dropped — a sentence that opens on a slot yields no empty run in the DOM.
 */
export function composeOffer(sentence: string, from: Language, to: Language): SentenceRun[] {
  return sentence
    .split(SLOT)
    .map((part, index) => {
      if (index % 2 === 0) {
        return { text: part, lang: null };
      }

      const lang = part === 'from' ? from : to;

      return { text: nativeName(lang), lang };
    })
    .filter((run) => run.text.length > 0);
}

/**
 * Every string the card renders, resolved together with the `lang` they are labelled with.
 *
 * Resolving them as one value is the point: the card holds prose in one language and two language
 * names in two others, and the only way `lang` can be guaranteed to describe the prose is for both to
 * come out of the same call, off the same `loaded` answer. Reading the strings in one place and
 * deciding the attribute in another is exactly how the card ended up as English prose under
 * `lang="fr"`.
 */
export interface OfferCopy {
  /** The language the prose below is written in — what belongs on the card's `lang` attribute. */
  readonly lang: Language;
  readonly region: string;
  readonly title: string;
  readonly body: SentenceRun[];
  readonly accept: string;
  readonly dismiss: string;
}

/** Reads one `common` key in a named language. `options` carries the accept label's interpolation. */
export type OfferTranslate = (lng: Language, key: string, options?: { language: string }) => string;

/**
 * Resolve the card's copy from whichever language's bundle is actually in the store.
 *
 * `loaded` answers "is the offered language's copy here *now*", and it has to be asked of the resource
 * store rather than of a load promise — see offerCopyLanguage. When the answer is no, every string is
 * read from English and `lang` says `en`, so the card is honest rather than mislabelled; the caller
 * re-resolves when the bundle lands, and the card upgrades itself to the offered language.
 */
export function resolveOfferCopy(
  current: Language,
  suggested: Language,
  loaded: boolean,
  translate: OfferTranslate
): OfferCopy {
  const lang = offerCopyLanguage(suggested, loaded);

  return {
    lang,
    region: translate(lang, 'languageSuggestion.region'),
    title: translate(lang, 'languageSuggestion.title'),
    body: composeOffer(translate(lang, 'languageSuggestion.body'), current, suggested),
    accept: translate(lang, 'languageSuggestion.accept', { language: nativeName(suggested) }),
    dismiss: translate(lang, 'languageSuggestion.dismiss'),
  };
}
