import { colors } from '@/src/styles/theme';

// One home for the brand gradients, so the signature lavender→pink reads identically on the compile
// ring, the progress meter, the record button and every gradient CTA. `expo-linear-gradient` and
// `react-native-svg` both take a plain colour array; tuples keep the two-stop cases type-safe.
export const gradients = {
  brand: [colors.primary, colors.secondary] as const, // signature lavender → pink
  brandDeep: [colors.primaryDark, colors.primary] as const,
  sunrise: [colors.secondary, colors.accent] as const, // pink → yellow
  violet: ['#6A70E3', '#A07BF0'] as const,
  // The dark "render theater" gradient — the compile overlay + program-monitor stage. Stays dark.
  monitor: ['#0B1020', '#12183A', '#1B2350'] as const,
};

// Deterministic cover palette — template thumbnails aren't generated, so each card picks a cover from
// this set by hashing its name (distinct per template, cohesive across the grid).
export const covers = [gradients.brand, gradients.brandDeep, gradients.sunrise, gradients.violet] as const;

export const coverFor = (name: string): readonly [string, string] => {
  let sum = 0;

  for (const ch of name) sum += ch.codePointAt(0) ?? 0;

  return covers[sum % covers.length];
};

// Direction presets for LinearGradient (`start`/`end`).
export const gradientDir = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  horizontal: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
};

export type GradientName = keyof typeof gradients;
