// Horizontal carousel of look presets. Each card shows a swatch tinted to approximate the look
// (a two-stop gradient — a cheap RN stand-in for the graded image). Applies section.look via
// onChange (the screen wires it to patchSection). LOOK_PRESETS is imported from the core, never hardcoded.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { LOOK_PRESETS } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';

type LookOption = { value: string | undefined; label: string; from: string; to: string };

// Two-stop gradients chosen to read like the named grade at a glance — preview only, never rendered.
const LOOK_SWATCHES: Record<(typeof LOOK_PRESETS)[number], [string, string]> = {
  cinematic: ['#1c2530', '#c08b5c'],
  warm: ['#ffb56b', '#ff7e5f'],
  cool: ['#5b9fe3', '#9be1ff'],
  vintage: ['#d9b382', '#7a5c3e'],
  noir: ['#2b2b2b', '#0a0a0a'],
  vivid: ['#ff3d77', '#ffd23f'],
  dreamy: ['#c8a2ff', '#ffc8e6'],
};

const OPTIONS: LookOption[] = [
  { value: undefined, label: 'None', from: colors.divider, to: colors.background },
  ...LOOK_PRESETS.map((name) => ({
    value: name,
    label: name,
    from: LOOK_SWATCHES[name][0],
    to: LOOK_SWATCHES[name][1],
  })),
];

interface LookCarouselProps {
  look: string | undefined;
  t: TFunction<'editor'>;
  onChange: (look: string | undefined) => void;
}

export const LookCarousel = ({ look, t, onChange }: LookCarouselProps) => (
  <View>
    <Text style={styles.label}>{t('look.label')}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {OPTIONS.map((option) => {
        const active = (look ?? undefined) === option.value;

        return (
          <TouchableOpacity
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Look ${option.label}`}
            onPress={() => {
              onChange(option.value);
            }}
            style={[styles.card, active && styles.cardActive]}
          >
            <LinearGradient
              colors={[option.from, option.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.swatch}
            >
              {option.value === undefined ? (
                <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
              ) : null}
              {active ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              ) : null}
            </LinearGradient>
            <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>
              {option.value === undefined ? t('look.none') : option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  label: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.m,
  },
  row: { gap: spacing.s, paddingVertical: spacing.xs, paddingRight: spacing.m },
  card: { alignItems: 'center', width: 74 },
  cardActive: {},
  swatch: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    ...typography.smallText,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  cardLabelActive: { color: colors.primary, fontWeight: '700' },
});
