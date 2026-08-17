import { useCallback, useEffect, useState } from 'react';
import { isBot } from '@/lib/isBot';
import { readConsent, setConsent, type ConsentChoice } from '@/lib/analytics';

/**
 * The visitor's analytics answer, the setter the banner calls, and the footer's way back to the
 * question. `answered` starts true and is corrected in an effect, so the bar is never in the first
 * render — it would otherwise flash over the hero for everyone, including a visitor who answered
 * months ago. Crawlers count as answered.
 */
export function useConsent(): {
  answered: boolean;
  answer: (choice: ConsentChoice) => void;
  reopen: () => void;
} {
  const [answered, setAnswered] = useState(true);

  useEffect(() => {
    if (isBot()) {
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

  return { answered, answer, reopen };
}
