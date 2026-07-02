import type { Transition } from 'motion/react';

// One motion vocabulary for the kinetic primitives (motion/react side), aligned to the Expo
// `motion.ts` durations/spring so web and mobile feel like one hand made them. Durations are in
// SECONDS (motion/react's unit); the mirrored CSS tokens (`--dur-*`) live in index.css.
export const kineticMotion = {
  duration: {
    fast: 0.2,
    base: 0.28,
    slow: 0.38,
    ring: 0.36,
  },
  // Delay between successive words in a KineticHeading reveal (seconds).
  stagger: 0.06,
  spring: {
    // ≈ the Expo `tap` spring — a quick, tactile dip.
    tap: { type: 'spring', stiffness: 500, damping: 18, mass: 0.6 } satisfies Transition,
  },
} as const;
