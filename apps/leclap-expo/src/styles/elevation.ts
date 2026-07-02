import { StyleSheet } from 'react-native';
import { colors } from '@/src/styles/theme';

// Signature elevation: a brand-tinted soft shadow paired with a hairline border, instead of the
// generic `#000` Material drop shadow (which reads as untinted "AI default"). Generalized from the
// shadow TemplateCard already ships. Spread onto StyleSheet styles or Tamagui components alike.
export const elevation = {
  // A 1px tinted separator with no lift — for flush rows and dividers.
  hairline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // The default resting card: gentle lavender-tinted lift + hairline.
  card: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // A floating surface: sheets, the create CTA, anything meant to sit above the page.
  raised: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // The pressed state of a card — shadow pulls in as the surface dips toward the page.
  pressed: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
};
