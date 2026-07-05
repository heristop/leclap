import { useState, useEffect, useCallback } from 'react';
import { isBot } from '@/lib/isBot';

const STORAGE_KEY = 'leclap.onboarded';

/** Custom event other components can dispatch to (re)open the guided intro. */
export const OPEN_ONBOARDING_EVENT = 'leclap:open-onboarding';

/**
 * Gate for the onboarding flow. Persists a flag in localStorage so the guided
 * intro only shows once. It never auto-opens on mount — the landing page keeps
 * its first impression; callers trigger it explicitly: `openIfFirstTime` on the
 * first studio entry, or OPEN_ONBOARDING_EVENT for an on-demand replay from the
 * "See how it works" button. `dismiss` marks it complete; `restart` replays it.
 * Never opens for bots/agents.
 */
export function useOnboarding() {
  const [show, setShow] = useState(false);

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

  // Opens the guided intro once, the first time it's requested (e.g. the first studio visit). No-op
  // for bots/agents and for anyone who has already completed or dismissed it. Stable identity so the
  // caller's effect only fires on route change, not on every render.
  const openIfFirstTime = useCallback(() => {
    if (isBot()) {
      return;
    }

    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') {
        setShow(true);
      }
    } catch {
      // Private mode / storage disabled — don't nag.
    }
  }, []);

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

  return { show, dismiss, restart, openIfFirstTime };
}
