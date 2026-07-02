// App-UI internationalization. Separate from the core `Translation` type, which carries per-template
// content. Importing this module initializes i18next; it's imported once from app/_layout.tsx.
//
// Ships English, French, German, Spanish and Italian. The active language follows the device locale
// (expo-localization), falling back to English when the device language isn't one we translate.
//
// Usage:  const { t } = useTranslation('editor'); t('section.duration')
// Alerts: Alert.alert(t('alerts.nameRequired.title'), t('alerts.nameRequired.message'))
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it } from './locales/it';

export const defaultNS = 'common';

const SUPPORTED = ['en', 'fr', 'de', 'es', 'it'] as const;
type Supported = (typeof SUPPORTED)[number];

// The device language narrowed to a language we ship, else English. `getLocales()` is a native call —
// guard it so a missing native module (e.g. before a rebuild) degrades to English instead of crashing.
function deviceLanguage(): Supported {
  try {
    const code = getLocales()[0].languageCode ?? 'en';

    return (SUPPORTED as readonly string[]).includes(code) ? (code as Supported) : 'en';
  } catch {
    return 'en';
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: { en, fr, de, es, it },
    lng: deviceLanguage(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED,
    defaultNS,
    ns: Object.keys(en),
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  })
  .catch(() => {});

export default i18n;
