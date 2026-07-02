import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { countAtProgress } from '@/lib/count-up';

/**
 * Ramp a number from 0 up to `target` over `durationMs` once `active` turns true, on an
 * ease-out-expo rAF curve so it decelerates like the rest of the motion system. Reduced-motion (or an
 * inactive trigger) settles straight to the target with no animation. Cleans up its frame on unmount.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100, decimals = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) return () => {};

    if (reduced) {
      setValue(target);

      return () => {};
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(countAtProgress(target, progress, decimals));

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame.current);
    };
  }, [target, active, durationMs, decimals, reduced]);

  return value;
}
