import 'react-i18next';
import type { Resources } from '@/src/i18n/locales/en';

// Compile-time key safety for t('...') and useTranslation(ns).
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}
