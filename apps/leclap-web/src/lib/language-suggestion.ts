import { LOCALE_CODES, type Language } from '@/config/site';

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
