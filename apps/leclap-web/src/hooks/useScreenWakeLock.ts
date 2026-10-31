import { useEffect } from 'react';
import { keepScreenAwake } from '@/lib/screen-wake-lock';

export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return () => {};

    return keepScreenAwake();
  }, [active]);
}
