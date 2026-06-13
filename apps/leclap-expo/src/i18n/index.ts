// App-UI internationalization (English-only for now). Separate from the core
// `Translation` type, which carries per-template content. Importing this module
// initializes i18next; it's imported once from app/_layout.tsx.
//
// Usage:  const { t } = useTranslation('editor'); t('section.duration')
// Alerts: Alert.alert(t('alerts.nameRequired.title'), t('alerts.nameRequired.message'))
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
    compatibilityJSON: 'v4',
  })
  .catch(() => {});

export default i18n;
