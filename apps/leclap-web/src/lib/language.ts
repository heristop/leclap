import i18n, { supportedLngs } from '@/i18n';

export type Language = (typeof supportedLngs)[number];

const FALLBACK: Language = 'en';

// Endonyms — each language labelled in its own tongue, the convention for a language picker
// (a French speaker scans for "Français", not "French"). Order: English first, then by reach.
export const LANGUAGES: ReadonlyArray<{ code: Language; nativeName: string }> = [
  { code: 'en', nativeName: 'English' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'es', nativeName: 'Español' },
  { code: 'it', nativeName: 'Italiano' },
];

// English lives at the root (x-default); every other language is served under a path prefix
// (/fr, /de, …) so each language has its own crawlable URL — the Google-recommended pattern
// for multilingual SEO. The active language is therefore derived from the URL, not localStorage.
export const LOCALE_PREFIXES: Language[] = LANGUAGES.map((l) => l.code).filter((c) => c !== 'en');

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

  if (target === 'en') {
    return bare;
  }

  return `/${target}${bare === '/' ? '' : bare}`;
};
