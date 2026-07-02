import { createTamagui, createFont } from '@tamagui/core';
import { defaultConfig } from '@tamagui/config/v5';
import { animations } from '@tamagui/config/v5-rn';

// Custom font configuration
const oswaldFont = createFont({
  family: 'Oswald',
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    true: 14,
    5: 16,
    6: 18,
    7: 20,
    8: 22,
    9: 30,
    10: 42,
    11: 52,
    12: 62,
    13: 72,
    14: 92,
    15: 114,
    16: 124,
  },
  // Oswald is condensed: display sizes get tight line-heights (≈0.95×) and negative tracking; body
  // sizes stay comfortable. Explicit lineHeight avoids RN clipping ascenders/accents at large sizes.
  lineHeight: {
    1: 16,
    2: 17,
    3: 18,
    4: 20,
    true: 20,
    5: 22,
    6: 24,
    7: 26,
    8: 28,
    9: 38,
    10: 50,
    11: 61,
    12: 73,
    13: 84,
    14: 108,
    15: 134,
    16: 146,
  },
  letterSpacing: {
    1: 0.2,
    2: 0.2,
    3: 0.2,
    4: 0.2,
    true: 0.2,
    5: 0.2,
    6: 0.1,
    7: 0.1,
    8: 0.1,
    9: 0,
    10: -0.25,
    11: -0.5,
    12: -0.75,
    13: -1,
    14: -1.2,
    15: -1.5,
    16: -1.75,
  },
  weight: {
    1: '300',
    2: '400',
    3: '500',
    4: '600',
    5: '700',
    6: '800',
    7: '900',
  },
  // Only Oswald 300–700 are loaded (app/_layout.tsx). Map the 800/900 weight tokens onto the 700 face
  // so a `fontWeight="800"` resolves to a real bundled face instead of a silent synthetic fallback.
  face: {
    300: { normal: 'Oswald_300Light' },
    400: { normal: 'Oswald_400Regular' },
    500: { normal: 'Oswald_500Medium' },
    600: { normal: 'Oswald_600SemiBold' },
    700: { normal: 'Oswald_700Bold' },
    800: { normal: 'Oswald_700Bold' },
    900: { normal: 'Oswald_700Bold' },
  },
});

// Custom media queries
const media = {
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
};

// LeClap custom tokens extending the base config
const leClapConfig = createTamagui({
  ...defaultConfig,
  animations,
  // Preserve Tamagui v1 (config v4) layout/style behavior during the v2 migration.
  // See https://tamagui.dev/docs/guides/how-to-upgrade
  settings: {
    ...defaultConfig.settings,
    styleCompat: 'legacy',
    defaultPosition: 'relative',
    onlyAllowShorthands: false,
    // RN app (not web) and v1-compatible: allow raw numeric style values
    // (e.g. space={1}) in addition to tokens.
    allowedStyleValues: 'somewhat-strict',
  },
  fonts: {
    ...defaultConfig.fonts,
    body: oswaldFont,
    heading: oswaldFont,
  },
  media,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      // LeClap brand colors
      color1: '#7C83FD', // primary - Bleu lavande
      color2: '#6A70E3', // primaryDark
      color3: '#FFE45E', // accent - Jaune pastel
      color4: '#FF8AAE', // secondary - Rose clair
      color5: '#F4F3FA', // background - lavender-tinted (matches theme.ts)
      color6: '#FCFBFF', // surface - off-white, subtly tinted
      color7: '#17142B', // text - deep ink with brand tint
      color8: '#6E6A82', // textSecondary - tinted gray
      color9: '#E7E4F2', // divider - tinted
      color10: '#3FB27F', // success
      color11: '#F4505A', // error
      color12: '#FF9800', // warning
      color13: '#2196F3', // info

      // Override default theme colors with LeClap brand (tinted neutrals — no flat "AI default" gray)
      background: '#F4F3FA',
      backgroundHover: '#EDEBF6',
      backgroundPress: '#E6E3F2',
      backgroundFocus: '#F0EEF8',
      backgroundStrong: '#FFFFFF',
      backgroundTransparent: 'rgba(244, 243, 250, 0)',
      color: '#17142B',
      colorHover: '#2C2843',
      colorPress: '#45415C',
      colorFocus: '#2C2843',
      colorTransparent: 'rgba(23, 20, 43, 0)',
      borderColor: '#E7E4F2',
      borderColorHover: '#D6D2E8',
      borderColorFocus: '#7C83FD',
      borderColorPress: '#C8C3DE',
      placeholderColor: '#6E6A82',

      // Brand-specific colors
      primary: '#7C83FD',
      primaryHover: '#6A70E3',
      primaryPress: '#5A60D3',
      primaryFocus: '#7C83FD',
      secondary: '#FF8AAE',
      secondaryHover: '#FF7A9E',
      secondaryPress: '#FF6A8E',
      accent: '#FFE45E',
      accentHover: '#FFED8A',
      accentPress: '#F2D63C',
      success: '#3FB27F',
      error: '#F4505A',
      warning: '#FF9800',
      info: '#2196F3',
    },
    dark: {
      ...defaultConfig.themes.dark,
      // Dark theme variations
      color1: '#7C83FD',
      color2: '#6A70E3',
      color3: '#FFE45E',
      color4: '#FF8AAE',
      color5: '#121212', // dark background
      color6: '#1E1E1E', // dark surface
      color7: '#FFFFFF', // light text
      color8: '#B0B0B0', // secondary text
      color9: '#333333', // divider
      color10: '#3FB27F',
      color11: '#F4505A',
      color12: '#FF9800',
      color13: '#2196F3',

      background: '#121212',
      backgroundHover: '#1E1E1E',
      backgroundPress: '#2A2A2A',
      backgroundFocus: '#262626',
      backgroundStrong: '#1E1E1E',
      color: '#FFFFFF',
      colorHover: '#F5F5F5',
      colorPress: '#E0E0E0',
      borderColor: '#333333',
      borderColorHover: '#444444',
      borderColorFocus: '#7C83FD',
      placeholderColor: '#B0B0B0',

      primary: '#7C83FD',
      primaryHover: '#8A8FFF',
      primaryPress: '#9CA1FF',
      secondary: '#FF8AAE',
      accent: '#FFE45E',
      success: '#3FB27F',
      error: '#F4505A',
      warning: '#FF9800',
      info: '#2196F3',
    },
  },
  tokens: {
    ...defaultConfig.tokens,
    // Brand colors as global tokens so `$primary`, `$primaryHover`, ... are
    // type-valid anywhere. The light/dark themes still override these per-theme
    // at runtime; the token value is the fallback / default-theme value.
    color: {
      primary: '#7C83FD',
      primaryHover: '#6A70E3',
      primaryPress: '#5A60D3',
      primaryFocus: '#7C83FD',
      secondary: '#FF8AAE',
      secondaryHover: '#FF7A9E',
      secondaryPress: '#FF6A8E',
      accent: '#FFE45E',
      accentHover: '#FFED8A',
      accentPress: '#F2D63C',
      success: '#3FB27F',
      error: '#F4505A',
      warning: '#FF9800',
      info: '#2196F3',
    },
    // Custom spacing tokens matching LeClap theme.
    // Keys are bare names (xs/s/m/...) and referenced in components as $xs/$s/$m.
    space: {
      ...defaultConfig.tokens.space,
      xs: 4,
      s: 8,
      m: 16,
      l: 24,
      xl: 32,
      xxl: 48,
    },
    // Custom radius tokens
    radius: {
      ...defaultConfig.tokens.radius,
      0: 0,
      1: 4,
      2: 6,
      3: 8,
      4: 12,
      5: 16,
      6: 20,
      true: 8,
    },
    // Custom z-index tokens
    zIndex: {
      ...defaultConfig.tokens.zIndex,
      0: 0,
      1: 100,
      2: 200,
      3: 300,
      4: 400,
      5: 500,
    },
  },
});

export default leClapConfig;

export type Conf = typeof leClapConfig;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {
    _brand?: never;
  }
}
