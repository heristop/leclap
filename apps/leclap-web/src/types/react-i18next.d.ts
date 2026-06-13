import 'react-i18next';
import type { Resources } from '@/i18n/locales/en';

// Compile-time key safety: t('...') and useTranslation(ns) are checked against
// the English bundle, so typos and missing keys fail typecheck.
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}
