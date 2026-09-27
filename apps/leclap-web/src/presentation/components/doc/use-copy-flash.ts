import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

// Long enough to read the checkmark, short enough that a second copy gets its own confirmation.
const FLASH_MS = 1500;

// Clipboard write + a transient `copied` flag, shared by every copy affordance in the docs (command
// pills, code blocks, the Copy-page button). A repeat copy restarts the flash instead of stacking
// timers, and an unmount mid-flash cancels it.
export function useCopyFlash(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  useEffect(() => cancel, []);

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        cancel();
        timer.current = setTimeout(() => {
          setCopied(false);
        }, FLASH_MS);
      })
      .catch((error: unknown) => {
        logger.error('Copy failed', error);
      });
  };

  return { copied, copy };
}
