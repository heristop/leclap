import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, type ColorTokens, type FontTokens, Text, YStack, XStack, View } from 'tamagui';
import { LinearGradient } from 'expo-linear-gradient';
import type { Template } from '@/src/types';
import { buildDescriptionVars, resolveVariables } from '@/src/utils/i18nText';
import { colors as theme, fonts } from '@/src/styles/theme';

interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
}

// Template thumbnails aren't generated server-side, so each card uses a deterministic
// brand-gradient cover instead of a broken image request — distinct per template, cohesive
// across the set.
const GRADIENTS: [string, string][] = [
  ['#7C83FD', '#FF8AAE'], // lavender → pink
  ['#5B61D6', '#7C83FD'], // deep lavender → lavender
  ['#FF8AAE', '#FFE45E'], // pink → warm yellow
  ['#6A70E3', '#A07BF0'], // indigo → violet
];

const gradientFor = (name: string): [string, string] => {
  let sum = 0;

  for (const ch of name) sum += ch.codePointAt(0) ?? 0;

  return GRADIENTS[sum % GRADIENTS.length];
};

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onPress }) => {
  const { t } = useTranslation('templates');
  const orientation = template.content.global?.orientation ?? 'portrait';
  const templateName = template.name.replace('.json', '');

  // Interpolate the first section's `{{ tokens }}` against the template's variable defaults so the
  // card preview reads with real values (no project/answers yet — globals only), matching the web.
  const rawDescription = template.content.sections?.find((section) => section.description?.en)?.description?.en;
  const description = rawDescription
    ? resolveVariables(
        rawDescription,
        buildDescriptionVars(template.content.global?.variables, template.content.global?.colorsList)
      )
    : t('cardDefaultDescription');

  const [c1, c2] = gradientFor(templateName);

  // The Tamagui config registers an animation driver at runtime, but its prop types
  // aren't injected into component props in this setup — pass `animation` via a typed
  // spread so the value is applied without an untyped/`any` escape.
  const animationProps: { animation: string } = { animation: 'quick' };

  return (
    <Card
      size="$4"
      {...animationProps}
      pressStyle={{ scale: 0.97 }}
      onPress={() => {
        onPress(template);
      }}
      width="45%"
      margin="$s"
      overflow="hidden"
      backgroundColor={theme.surface as ColorTokens}
      borderWidth={1}
      borderColor={theme.divider as ColorTokens}
      borderRadius={20}
      shadowColor={theme.primary as ColorTokens}
      shadowOffset={{ width: 0, height: 6 }}
      shadowOpacity={0.14}
      shadowRadius={14}
    >
      <YStack>
        <View height={150} alignItems="center" justifyContent="center" overflow="hidden">
          <LinearGradient
            colors={[c1, c2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="film-outline" size={46} color="rgba(255,255,255,0.92)" />

          {/* `Custom` badge for user-built templates — iso with the web TemplateSelector (brand badge). */}
          {template.source === 'user' && (
            <XStack
              position="absolute"
              top="$s"
              left="$s"
              backgroundColor={theme.primary as ColorTokens}
              paddingHorizontal="$s"
              paddingVertical="$xs"
              borderRadius={999}
              alignItems="center"
              gap={4}
            >
              <Ionicons name="sparkles" size={11} color="white" />
              <Text fontFamily={fonts.poppins.semiBold as FontTokens} fontSize={11} color="white">
                {t('custom')}
              </Text>
            </XStack>
          )}

          <XStack
            position="absolute"
            top="$s"
            right="$s"
            backgroundColor="rgba(27,24,48,0.55)"
            paddingHorizontal="$s"
            paddingVertical="$xs"
            borderRadius={999}
            alignItems="center"
            accessibilityLabel={orientation === 'portrait' ? 'Portrait video' : 'Landscape video'}
          >
            <Ionicons
              name={orientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'}
              size={14}
              color="white"
            />
          </XStack>
        </View>

        <YStack paddingHorizontal="$m" paddingVertical="$s" gap={2}>
          <Text
            fontFamily={fonts.poppins.semiBold as FontTokens}
            fontSize={18}
            color={theme.text as ColorTokens}
            numberOfLines={1}
          >
            {templateName}
          </Text>
          <Text fontSize={13} lineHeight={18} color={theme.textSecondary as ColorTokens} numberOfLines={2}>
            {description}
          </Text>
        </YStack>
      </YStack>
    </Card>
  );
};

export default TemplateCard;
