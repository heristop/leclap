// LeClap theme and styling constants

// Define font families
// Using system fonts for now until we can properly load custom fonts
export const fonts = {
  poppins: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  inter: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
};

export const colors = {
  primary: '#7C83FD', // Bleu lavande - doux et créatif
  primaryDark: '#6A70E3', // Darker version of primary for depth
  accent: '#FFF685', // Jaune pastel - pour l'énergie et le fun
  background: '#F2F2F2', // Gris clair - pour les fonds
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  divider: '#E0E0E0',
  secondary: '#FF8AAE', // Rose clair - chaleureux, friendly
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
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
