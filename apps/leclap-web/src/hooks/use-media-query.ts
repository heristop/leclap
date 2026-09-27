import { useSyncExternalStore } from 'react';

/** Whether a media query matches — live, so crossing a breakpoint or flipping an OS setting applies at once. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const media = globalThis.matchMedia(query);
      media.addEventListener('change', onChange);

      return () => {
        media.removeEventListener('change', onChange);
      };
    },
    () => globalThis.matchMedia(query).matches,
    () => false
  );
