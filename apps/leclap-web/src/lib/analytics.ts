import { isBot } from '@/lib/isBot';

// Consent side of Google Analytics 4. The snippet in index.html denies Consent Mode, configures the
// property and defines loadGoogleAnalytics() without calling it, so until setConsent('granted') runs
// here gtag.js is not on the page and nothing has reached Google.

/** Where the visitor's answer to the consent banner is remembered. */
export const CONSENT_STORAGE_KEY = 'leclap-consent';

export type ConsentChoice = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    loadGoogleAnalytics?: () => void;
  }
}

/** The stored answer, or `null` for a visitor who has not answered. Junk never passes for a yes. */
export const parseConsent = (raw: string | null): ConsentChoice | null =>
  raw === 'granted' || raw === 'denied' ? raw : null;

/**
 * Whether hits may be sent. Accepting is necessary but not sufficient: a dev page load must not land
 * in the property, and a crawler never answered the banner. Pure, so the gate is testable.
 */
export const measurementAllowed = (env: { consent: ConsentChoice | null; prod: boolean; bot: boolean }): boolean =>
  env.consent === 'granted' && env.prod && !env.bot;

export const readConsent = (): ConsentChoice | null => {
  try {
    return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode) — unanswered, so nothing is sent
  }
};

const allowed = (consent: ConsentChoice | null): boolean =>
  measurementAllowed({ consent, prod: import.meta.env.PROD, bot: isBot() });

/** Remember the answer and, on a yes, start measuring from this pageview on. */
export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable — the answer holds for this pageview and is asked again next visit */
  }

  if (choice === 'denied') {
    // Someone reopening the question from the footer may have granted earlier, in which case gtag.js
    // is already on the page: tell it to drop the storage it was given rather than only going quiet.
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });

    return;
  }

  if (!allowed(choice)) {
    return;
  }

  window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
  window.loadGoogleAnalytics?.();
  trackPageView();
}

/**
 * Report the page the visitor is on. Nothing is queued without consent, so a later yes cannot flush
 * what someone browsed before giving it. `page_location` is the live URL, prefix included (/fr/studio).
 */
export function trackPageView(): void {
  if (!allowed(readConsent())) {
    return;
  }

  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_title: document.title,
  });
}
