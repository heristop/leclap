// One motion vocabulary shared across moti (timing) and reanimated (spring), so every surface —
// the compile ring, the shot-list reveal, tactile taps — feels like one hand made it. Durations are
// taken from the compile overlay (the proven reference); springs are numerically aligned to Tamagui's
// `quick`/`quicker` presets so JS- and Tamagui-driven motion match.
export const motion = {
  duration: {
    instant: 120,
    fast: 200,
    base: 280,
    slow: 380,
    ring: 360, // the overlay's arc withTiming duration
    breath: 1500, // the overlay's breathing-logo loop
    halo: 1900, // the overlay's halo loop
  },
  spring: {
    tap: { damping: 18, stiffness: 500, mass: 0.6 }, // ≈ tamagui 'quicker'
    enter: { damping: 20, stiffness: 180, mass: 0.8 },
    playhead: { damping: 25, stiffness: 120 }, // smooth scrub
  },
  // Delay between successive words/lines in a KineticHeading reveal (ms).
  stagger: 60,
};

export type MotionSpring = keyof typeof motion.spring;
