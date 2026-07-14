import type { RefObject } from 'react';
import { useScroll, useTransform, type MotionValue } from 'motion/react';

export interface ScrollReveal {
  opacity: MotionValue<number>;
  y: MotionValue<number>;
  rotateX: MotionValue<number>;
  scale: MotionValue<number>;
}

// Scroll-scrubbed reveal that echoes the hero ghost panels: as the target crosses the viewport the
// element rises, fades and tilts up into place, crests, then parallax-drifts on out — a pure scrub,
// so it reverses cleanly on scroll up. `progress` is measured as the target passes through the
// viewport (`offset: ['start end', 'end start']`): 0 just below the fold, 0.5 centred, 1 just above.
// Apply the returned MotionValues to a `motion.*` element that sits inside a perspective ancestor so
// the `rotateX` reads as depth. Skip applying them under reduced motion — the bare element stays put.
export function useScrollReveal(target: RefObject<HTMLElement | null>): ScrollReveal {
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end start'] });

  const opacity = useTransform(scrollYProgress, [0, 0.22, 0.9, 1], [0, 1, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [64, 0, -56]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [7, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.94, 1]);

  return { opacity, y, rotateX, scale };
}
