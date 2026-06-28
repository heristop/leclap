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
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it } from './locales/it';

export const defaultNS = 'common';
export const supportedLngs = ['en', 'fr', 'de', 'es', 'it'] as const;

const applyDocumentLang = (lng: string): void => {
  if (typeof document === 'undefined') {
    return;
  }
  // `load: 'languageOnly'` collapses fr-FR/fr-CA to fr; reflect the base language on <html>.
  document.documentElement.lang = lng.split('-')[0];
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, fr, de, es, it },
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
