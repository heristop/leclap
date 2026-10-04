// Theme tokens: one palette, one type stack and one motion feel per template, named once in
// `global.theme` and referenced everywhere as `$color.<name>` / `$font.<name>`. The built-ins mirror the
// LeClap brand (DESIGN.md) and the palettes the bundled kit templates already use, so a template can swap
// its whole look by changing one name.

import type { EasingSpec } from '../motion/easing';

export const THEME_COLOR_NAMES = ['bg', 'fg', 'muted', 'surface', 'brand', 'accent', 'accent2'] as const;
export const THEME_FONT_NAMES = ['display', 'body', 'mono'] as const;

export type ThemeColorName = (typeof THEME_COLOR_NAMES)[number];
export type ThemeFontName = (typeof THEME_FONT_NAMES)[number];

export type ThemeColors = Record<ThemeColorName, string>;
/** Bundled font ids (`bebas`) or `.ttf` file names, as every other font field accepts them. */
export type ThemeFonts = Record<ThemeFontName, string>;

export interface ThemeMotion {
  /** Default for `global.motion.energy`. */
  energy?: number;
  /** Becomes the `$theme` motion token (any easing spec, or a `$token` such as `$snappy`). */
  ease?: EasingSpec;
  /** Becomes the `$beat` duration token, in seconds. */
  beat?: number;
}

/** A theme as authored: every field optional, layered over `extends` (default: the brand theme). */
export interface ThemeInput {
  extends?: string;
  colors?: Partial<ThemeColors>;
  fonts?: Partial<ThemeFonts>;
  radius?: number;
  motion?: ThemeMotion;
}

/** `global.theme`: a built-in theme name or a theme object. */
export type ThemeSpec = string | ThemeInput;

export interface ResolvedTheme {
  /** The built-in the chain bottoms out at, or the theme's own name. */
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  /** Corner radius in output pixels, for builders that draw panels and plates. */
  radius: number;
  motion: ThemeMotion;
}

/** The theme `$color.*` / `$font.*` resolve against when a template names none. */
export const DEFAULT_THEME = 'leclap';

const BRAND: Required<Omit<ThemeInput, 'extends'>> = {
  colors: {
    bg: '#141416',
    fg: '#F5F3F7',
    muted: '#9A98A6',
    surface: '#1E1E24',
    brand: '#7C83FD',
    accent: '#FF8AAE',
    accent2: '#FFF685',
  },
  fonts: { display: 'bebas', body: 'oswald', mono: 'mono' },
  radius: 12,
  motion: { energy: 1, ease: '$juicy', beat: 0.6 },
};

/**
 * Built-in themes. Every theme but the brand one extends it, so a built-in only states what differs.
 * Descriptions are surfaced in the catalog to help an agent pick.
 */
export const BUILTIN_THEMES: Record<string, ThemeInput & { description: string }> = {
  leclap: { description: 'The LeClap brand: lavender and pink on near-black ink, juicy springs.', ...BRAND },
  midnight: {
    description: 'Calm navy for interviews and talking heads: lavender accent, slow and controlled.',
    extends: 'leclap',
    colors: {
      bg: '#0d1b2a',
      fg: '#f5f5f0',
      muted: '#9aa7c7',
      surface: '#13243f',
      brand: '#e8eef7',
      accent: '#7C83FD',
    },
    radius: 8,
    motion: { energy: 0.8, ease: '$smooth', beat: 0.8 },
  },
  editorial: {
    description: 'Warm black and sand with a serif display face: launches, luxury, quotes.',
    extends: 'leclap',
    colors: {
      bg: '#090909',
      fg: '#ffffff',
      muted: '#8c8576',
      surface: '#1a1814',
      brand: '#c8bc9c',
      accent: '#e7a23b',
      accent2: '#f7e2c4',
    },
    fonts: { display: 'playfair' },
    radius: 4,
    motion: { energy: 0.7, ease: '$expo', beat: 0.9 },
  },
  bold: {
    description: 'Ink and signal red, hard cuts and snappy springs: hooks, challenges, sport.',
    extends: 'leclap',
    colors: {
      bg: '#141416',
      fg: '#f5f5f0',
      muted: '#a1a1aa',
      surface: '#1f1f23',
      brand: '#ff2e4d',
      accent: '#ff2e4d',
    },
    radius: 0,
    motion: { energy: 1.3, ease: '$snappy', beat: 0.45 },
  },
  neon: {
    description: 'Deep green with an electric lime accent and bouncy motion: promos and social reels.',
    extends: 'leclap',
    colors: {
      bg: '#17211d',
      fg: '#ffffff',
      muted: '#9fb3a8',
      surface: '#22302a',
      brand: '#e6ff72',
      accent: '#e6ff72',
    },
    radius: 16,
    motion: { energy: 1.2, ease: '$bouncy', beat: 0.5 },
  },
  paper: {
    description: 'Light and neutral: pale sage canvas, deep green ink. Tutorials and explainers.',
    extends: 'leclap',
    colors: {
      bg: '#edf4ed',
      fg: '#172c25',
      muted: '#436354',
      surface: '#c8e4d7',
      brand: '#172c25',
      accent: '#2e7d5b',
      accent2: '#7C83FD',
    },
    radius: 12,
    motion: { energy: 0.9, ease: '$gentle', beat: 0.7 },
  },
};
