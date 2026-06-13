// The transition picker for the boundary between two scenes. Opens as a bottom sheet listing a
// "Cut" option plus the xfade transitions grouped (Fades/Wipes/Slides/...), with a duration slider.
// Writes a SectionTransition (or undefined for a cut) up to the screen, which calls setTransitionAfter.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Sheet } from './Sheet';
import { Slider } from './EditorControls';
import { transitionGroups } from './editorPrimitives';
import type { SectionTransition } from '../model/templateEditorModel';

const GROUPS = transitionGroups();
const DEFAULT_DURATION = 0.5;

interface TransitionSheetProps {
  visible: boolean;
  t: TFunction<'editor'>;
  transition: SectionTransition | undefined;
  onClose: () => void;
  onChange: (transition: SectionTransition | undefined) => void;
}

export const TransitionSheet = ({ visible, t, transition, onClose, onChange }: TransitionSheetProps) => {
  const isCut = !transition || transition.type === 'cut';
  const current = transition?.type ?? 'cut';
  const duration = transition?.duration ?? DEFAULT_DURATION;

  const pick = (type: string) => {
    onChange(type === 'cut' ? undefined : { type, duration });
  };

  return (
    <Sheet visible={visible} title={t('transition.title')} onClose={onClose}>
      <Text style={styles.help}>{t('transition.help')}</Text>

      <Tile
        name="Cut"
        label={t('transition.cutOption')}
        active={isCut}
        onPress={() => {
          pick('cut');
        }}
        icon="cut-outline"
      />

      {GROUPS.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.grid}>
            {group.names.map((name) => (
              <Tile
                key={name}
                name={name}
                label={name}
                active={!isCut && current === name}
                onPress={() => {
                  pick(name);
                }}
              />
            ))}
          </View>
        </View>
      ))}

      {transition && !isCut ? (
        <Slider
          label={t('transition.duration')}
          value={duration}
          min={0.1}
          max={2}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(d) => {
            onChange({ type: transition.type, duration: d });
          }}
        />
      ) : null}
    </Sheet>
  );
};

interface TileProps {
  name: string;
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

const Tile = ({ label, active, onPress, icon }: TileProps) => (
  <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
    onPress={onPress}
    style={[styles.tile, active && styles.tileActive]}
  >
    {icon ? <Ionicons name={icon} size={15} color={active ? '#fff' : colors.textSecondary} /> : null}
    <Text style={[styles.tileText, active && styles.tileTextActive]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  help: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.m },
  group: { marginTop: spacing.m },
  groupLabel: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tile: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileText: { ...typography.caption, color: colors.text },
  tileTextActive: { color: '#fff', fontWeight: '600' },
});
