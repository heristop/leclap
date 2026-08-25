// App-UI internationalization. English + French + German + Spanish + Italian; the key
// system makes adding more languages a drop-in (add a locale bundle + the switcher picks
// it up). This is separate from the core `Translation` type, which carries per-template content.
//
// Usage in components:  const { t } = useTranslation('builder'); t('steps.template')
// Interpolation:        t('clip', { index, name })
// Plurals:              t('sections', { count })  // sections_one / sections_other
//
// The active language is derived from the URL path prefix (/fr, /de, …); English is served
// at the root as the x-default. This keeps each language on its own crawlable URL (the
// Google-recommended multilingual-SEO pattern) and avoids serving two languages from one URL.
// The resolved language is mirrored onto <html lang> so the document advertises it to crawlers
// and assistive tech. Switching language navigates to the prefixed URL (see lib/language.ts).
import i18n, { type ReadCallback, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { LOCALE_CODES } from '@/config/site';
import { en } from './locales/en';

export const defaultNS = 'common';

/** The shipped languages, from the site manifest — the one place the list is written down. */
export const supportedLngs = LOCALE_CODES;

const applyDocumentLang = (lng: string): void => {
  if (typeof document === 'undefined') {
    return;
  }
  // `load: 'languageOnly'` collapses fr-FR/fr-CA to fr; reflect the base language on <html>.
  document.documentElement.lang = lng.split('-')[0];
};

// English stays in the entry chunk: it is the fallback and the language served at the root URL, so
// a lazy `en` would just be a guaranteed extra round-trip. The other four are one dynamic chunk
// each — the barrel, not the raw JSON, so `satisfies LocaleShape<Resources>` still gates parity.
//
// Only ever one of them loads per session: the language comes from the URL path prefix, and the
// switcher navigates (window.location.assign) rather than calling changeLanguage.
//
// The specifier has to stay statically analysable — one interpolated segment and the explicit
// `/index.ts` — or the bundler gives up on the pattern and inlines every locale back into the
// entry chunk, which builds and tests exactly the same but ships nothing smaller.
//
// The three-argument (callback) form is mandatory here. Given a promise-returning loader,
// i18next-resources-to-backend resolves it with `callback(null, data && data.default || data)` —
// and every locale's `seo.json` has a top-level `default` key, so that unwrap would silently
// replace the whole `seo` namespace with its own `default` sub-object. The callback form skips the
// unwrap entirely.
const localeBackend = resourcesToBackend((language: string, namespace: string, callback: ReadCallback) => {
  import(`./locales/${language}/index.ts`).then(
    (bundle: Record<string, Record<string, ResourceKey>>) => {
      callback(null, bundle[language][namespace]);
    },
    (error: unknown) => {
      callback(error instanceof Error ? error : new Error(String(error)), null);
    }
  );
});

export const i18nReady = i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en },
    // `resources` carries English only, so the detected language's namespaces still have to come
    // from the backend above; without this flag i18next treats a non-empty `resources` as complete
    // and never asks.
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: [...supportedLngs],
    load: 'languageOnly',
    defaultNS,
    ns: Object.keys(en),
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      // URL path prefix is authoritative (/fr/… → fr). Unprefixed paths fall through to the
      // fallback (en). `caches: []` so a stored choice can never override the URL's language.
      order: ['path'],
      lookupFromPathIndex: 0,
      caches: [],
    },
  })
  .then(() => {
    applyDocumentLang(i18n.language);
  })
  .catch(() => {});

i18n.on('languageChanged', applyDocumentLang);

export default i18n;
