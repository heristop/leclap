import { useCallback, useEffect, useState } from 'react';
import { isBot } from '@/lib/isBot';
import { isConsentRequired, readConsent, setConsent, type ConsentChoice } from '@/lib/analytics';

/**
 * The visitor's analytics answer, the setter the banner calls, and the footer's way back to the
 * question. `answered` starts true and is corrected in an effect, so the bar is never in the first
 * render — it would otherwise flash over the hero for everyone, including a visitor who answered
 * months ago. Crawlers count as answered, and so does everyone under a cookieless tracker: there is
 * no question to put to them.
 *
 * `reopen` is undefined in that case, which is what removes the footer's link — the control renders
 * only when it is given one.
 */
export function useConsent(): {
  answered: boolean;
  answer: (choice: ConsentChoice) => void;
  reopen: (() => void) | undefined;
} {
  const [answered, setAnswered] = useState(true);

  useEffect(() => {
    if (isBot() || !isConsentRequired()) {
      return;
    }

    setAnswered(readConsent() !== null);
  }, []);

  const answer = useCallback((choice: ConsentChoice) => {
    setConsent(choice);
    setAnswered(true);
  }, []);

  // The stored answer stays put until a new one is given, so walking away from the reopened bar leaves
  // the previous choice in force rather than silently resetting it to "never asked".
  const reopen = useCallback(() => {
    setAnswered(false);
  }, []);

  return { answered, answer, reopen: isConsentRequired() ? reopen : undefined };
}
