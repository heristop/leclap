// LeClap theme and styling constants

// Font families. Oswald (a condensed, cinematic display face — fitting for a video tool)
// is loaded in app/_layout.tsx and used for display/headings/buttons; body text stays on
// the system UI font for legibility at small sizes. `poppins` = display, `inter` = body.
export const fonts = {
  // Display family — Oswald (condensed, cinematic) for titles, headings and buttons.
  poppins: {
    regular: 'Oswald_400Regular',
    medium: 'Oswald_500Medium',
    semiBold: 'Oswald_600SemiBold',
    bold: 'Oswald_700Bold',
  },
  // Body family — system UI font, most legible at body sizes.
  inter: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
};

// Neutrals are tinted toward the lavender brand hue for subconscious cohesion — no flat
// pure-white/pure-gray (which read as untinted "AI default").
export const colors = {
  primary: '#7C83FD', // Lavender — soft and creative
  primaryDark: '#5B61D6', // Deeper lavender for depth / pressed states
  accent: '#FFE45E', // Warm yellow — energy and fun
  background: '#F4F3FA', // Lavender-tinted light background
  surface: '#FCFBFF', // Off-white surface, subtly tinted
  text: '#1B1830', // Near-black with a brand-hue tint
  textSecondary: '#6E6A82', // Tinted secondary text (replaces flat #757575 gray)
  divider: '#E7E4F2', // Tinted divider
  secondary: '#FF8AAE', // Warm pink — friendly accent
  success: '#3FB27F',
  error: '#F4505A',
  warning: '#FF9800',
  info: '#2196F3',
};

// React Native's StyleSheet color parser has no oklch()/color-mix() — only hex, rgb(a), hsl(a), hwb,
// named colors and PlatformColor. To tint a brand color by opacity, expand a #RRGGBB hex to rgba() so
// the hue stays sourced from one token (e.g. colors.primary) instead of hardcoded rgb triplets.
export const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);

  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  title: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontFamily: fonts.poppins.semiBold,
    fontSize: 18,
    letterSpacing: 0.1,
  },
  heading: {
    fontFamily: fonts.poppins.medium,
    fontSize: 20,
    letterSpacing: 0.15,
  },
  body: {
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fonts.poppins.medium,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  caption: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  smallText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    letterSpacing: 0.4,
  },
};

const ThemeExports = {
  name: 'Theme',
};
export default ThemeExports;
