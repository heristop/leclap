// App-UI internationalization. English-only for now; the key system makes adding
// languages later a drop-in (add a locale bundle + a language switcher). This is
// separate from the core `Translation` type, which carries per-template content.
//
// Usage in components:  const { t } = useTranslation('builder'); t('steps.template')
// Interpolation:        t('clip', { index, name })
// Plurals:              t('sections', { count })  // sections_one / sections_other
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';

export const defaultNS = 'common';

i18n
  .use(initReactI18next)
  .init({
    resources: { en },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS,
    ns: Object.keys(en),
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  .catch(() => {});

export default i18n;
