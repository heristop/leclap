import { useEffect } from 'react';
import { useOrientation } from '@/src/hooks/useOrientation';

type RequiredOrientation = 'portrait' | 'landscape';

/**
 * Locks the device to the param-provided orientation while the preview screen
 * is mounted and restores it on unmount. Returns the effective orientation,
 * defaulting to portrait.
 */
export function useLockedOrientation(paramOrientation: RequiredOrientation | undefined): RequiredOrientation {
  const { lockOrientation, unlockOrientation } = useOrientation(paramOrientation);

  useEffect(() => {
    if (paramOrientation) {
      lockOrientation(paramOrientation).catch(() => null);
    }

    return () => {
      unlockOrientation().catch(() => null);
    };
  }, [paramOrientation, lockOrientation, unlockOrientation]);

  return paramOrientation ?? 'portrait';
}
