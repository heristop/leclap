import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import './index.css';
import i18n from '@/i18n';
import App from '@/App';
import { isBot } from '@/lib/isBot';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>
);

// Offline/PWA support. Registered in production only (so it never caches the dev server or
// fights HMR) and never for crawlers/automation.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isBot()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
