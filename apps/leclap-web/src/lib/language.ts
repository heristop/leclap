import i18n, { supportedLngs } from '@/i18n';
import { DEFAULT_LOCALE, LANGUAGE_STORAGE_KEY, LOCALE_PREFIXES, LOCALES, type Language } from '@/config/site';

export type { Language };

// The manifest owns the list; these are re-exported so call sites keep importing "the language
// module" for language things rather than reaching into config.
// LANGUAGES carries each endonym — a language picker labels every entry in its own tongue, since a
// French speaker scans for "Français", not "French".
export { LANGUAGE_STORAGE_KEY, LOCALE_PREFIXES };
export const LANGUAGES = LOCALES;

const FALLBACK: Language = DEFAULT_LOCALE;

/**
 * Remember a language the visitor picked themselves. The pre-paint redirect in index.html reads this
 * back on the next visit to the root and honours it over the browser's own languages — so choosing
 * English on a French browser sticks, instead of being undone by detection on the way back in.
 */
export const setStoredLanguage = (lng: Language): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* storage may be unavailable (private mode) — the URL still carries the language */
  }
};

const normalize = (lng: string | undefined): Language => {
  const base = (lng ?? '').split('-')[0];

  return supportedLngs.includes(base as Language) ? (base as Language) : FALLBACK;
};

/** Active UI language, normalized to a supported base language (read from the URL via i18next). */
export const getLanguage = (): Language => normalize(i18n.language);

/**
 * Map the current path to its equivalent under `target`, swapping any existing locale prefix.
 * `/fr/studio` + 'de' → `/de/studio`; `/fr/studio` + 'en' → `/studio`; `/about` + 'it' → `/it/about`.
 */
export const localePath = (target: Language, fullPath: string): string => {
  const parts = fullPath.split('/');

  if (LOCALE_PREFIXES.includes(parts[1] as Language)) {
    parts.splice(1, 1);
  }

  const bare = parts.join('/') || '/';

  if (target === DEFAULT_LOCALE) {
    return bare;
  }

  return `/${target}${bare === '/' ? '' : bare}`;
};
