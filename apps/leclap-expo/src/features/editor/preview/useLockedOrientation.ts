import { useEffect } from 'react';
import { useOrientation } from '@/src/hooks/useOrientation';

type RequiredOrientation = 'portrait' | 'landscape' | 'square';

/**
 * Locks the device to the param-provided orientation while the preview screen
 * is mounted and restores it on unmount. Returns the effective orientation,
 * defaulting to portrait. A square clip is shot with the phone upright, so the
 * device locks to portrait while the preview still frames the clip 1:1.
 */
export function useLockedOrientation(paramOrientation: RequiredOrientation | undefined): RequiredOrientation {
  const deviceOrientation = paramOrientation === 'landscape' ? 'landscape' : 'portrait';
  const { lockOrientation, unlockOrientation } = useOrientation(deviceOrientation);

  useEffect(() => {
    lockOrientation(deviceOrientation).catch(() => null);

    return () => {
      unlockOrientation().catch(() => null);
    };
  }, [deviceOrientation, lockOrientation, unlockOrientation]);

  return paramOrientation ?? 'portrait';
}
