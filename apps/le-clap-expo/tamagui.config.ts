import { createTamagui } from '@tamagui/core';
import { config } from '@tamagui/config';
import { createInterFont } from '@tamagui/font-inter';

// Custom font configuration
const interFont = createInterFont({
  family: 'Inter',
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
  weight: {
    1: '300',
    2: '400',
    3: '500',
    4: '600',
    5: '700',
    6: '800',
    7: '900',
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
  ...config,
  fonts: {
    body: interFont,
    heading: interFont,
  },
  media,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      // LeClap brand colors
      color1: '#7C83FD', // primary - Bleu lavande
      color2: '#6A70E3', // primaryDark
      color3: '#FFF685', // accent - Jaune pastel
      color4: '#FF8AAE', // secondary - Rose clair
      color5: '#F2F2F2', // background - Gris clair
      color6: '#FFFFFF', // surface
      color7: '#212121', // text
      color8: '#757575', // textSecondary
      color9: '#E0E0E0', // divider
      color10: '#4CAF50', // success
      color11: '#F44336', // error
      color12: '#FF9800', // warning
      color13: '#2196F3', // info

      // Override default theme colors with LeClap brand
      background: '#F2F2F2',
      backgroundHover: '#EEEEEE',
      backgroundPress: '#E8E8E8',
      backgroundFocus: '#F5F5F5',
      backgroundStrong: '#FFFFFF',
      backgroundTransparent: 'rgba(242, 242, 242, 0)',
      color: '#212121',
      colorHover: '#424242',
      colorPress: '#616161',
      colorFocus: '#424242',
      colorTransparent: 'rgba(33, 33, 33, 0)',
      borderColor: '#E0E0E0',
      borderColorHover: '#BDBDBD',
      borderColorFocus: '#7C83FD',
      borderColorPress: '#9E9E9E',
      placeholderColor: '#757575',

      // Brand-specific colors
      primary: '#7C83FD',
      primaryHover: '#6A70E3',
      primaryPress: '#5A60D3',
      primaryFocus: '#7C83FD',
      secondary: '#FF8AAE',
      secondaryHover: '#FF7A9E',
      secondaryPress: '#FF6A8E',
      accent: '#FFF685',
      accentHover: '#FFF575',
      accentPress: '#FFF465',
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
    },
    dark: {
      ...config.themes.dark,
      // Dark theme variations
      color1: '#7C83FD',
      color2: '#6A70E3',
      color3: '#FFF685',
      color4: '#FF8AAE',
      color5: '#121212', // dark background
      color6: '#1E1E1E', // dark surface
      color7: '#FFFFFF', // light text
      color8: '#B0B0B0', // secondary text
      color9: '#333333', // divider
      color10: '#4CAF50',
      color11: '#F44336',
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
      accent: '#FFF685',
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
    },
  },
  tokens: {
    ...config.tokens,
    // Custom spacing tokens matching LeClap theme
    space: {
      ...config.tokens.space,
      $xs: 4,
      $s: 8,
      $m: 16,
      $l: 24,
      $xl: 32,
      $xxl: 48,
    },
    // Custom radius tokens
    radius: {
      ...config.tokens.radius,
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
      ...config.tokens.zIndex,
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
  interface TamaguiCustomConfig extends Conf {}
}
