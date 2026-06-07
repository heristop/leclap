import { useState, useEffect } from 'react';

const STORAGE_KEY = 'leclap.onboarded';

/** Custom event other components can dispatch to (re)open the guided intro. */
export const OPEN_ONBOARDING_EVENT = 'leclap:open-onboarding';

/** Skip the auto-intro for automation, crawlers and AI agents. */
const isAutomated = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (navigator.webdriver) {
    return true;
  }

  return /bot|crawl|spider|headless|lighthouse|slurp|bingpreview|prerender|puppeteer|playwright/i.test(
    navigator.userAgent
  );
};

/**
 * First-visit gate for the onboarding flow. Persists a flag in localStorage so
 * the guided intro only shows once. `dismiss` marks it complete; `restart`
 * lets the user replay it (e.g. from a "See how it works" affordance). The
 * intro never auto-opens for bots/agents.
 */
export function useOnboarding() {
  const [show, setShow] = useState<boolean>(() => {
    if (isAutomated()) {
      return false;
    }

    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      // Private mode / storage disabled — don't nag on every load.
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setShow(false);
  };

  const restart = () => {
    setShow(true);
  };

  // Let any component (e.g. the Home "See how it works" button) open the intro.
  useEffect(() => {
    const open = () => {
      setShow(true);
    };
    window.addEventListener(OPEN_ONBOARDING_EVENT, open);

    return () => {
      window.removeEventListener(OPEN_ONBOARDING_EVENT, open);
    };
  }, []);

  return { show, dismiss, restart };
}
