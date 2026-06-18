// A proportional overview strip of the template's scenes — each visual scene is a chip whose width
// tracks its duration, tinted by kind (color scenes show their colour). Tapping a chip scrolls its card
// into view. The RN counterpart of the web TimelineStrip; purely a navigation aid (no reorder here —
// the cards have up/down controls).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, withAlpha } from '@/src/styles/theme';
import { isVisualKind } from './wizardSteps';
import type { EditorSection, EditorState } from '../model/templateEditorModel';

const KIND_ICON: Record<EditorSection['kind'], keyof typeof Ionicons.glyphMap> = {
  video: 'videocam',
  form: 'text',
  color: 'color-palette',
  music: 'musical-notes',
  image: 'image-outline',
  partial: 'cube-outline',
};

// A visual scene's duration drives its chip width; non-visual scenes (form/music/partial) have no
// duration, so they get a fixed minimum so they stay tappable.
const durationOf = (section: EditorSection): number =>
  isVisualKind(section.kind) && 'duration' in section ? section.duration : 1;

interface SceneTimelineProps {
  state: EditorState;
  t: TFunction<'editor'>;
  onSelect: (index: number) => void;
}

export const SceneTimeline = ({ state, t, onSelect }: SceneTimelineProps) => {
  if (state.sections.length < 2) return null;

  return (
    <View style={styles.strip} accessibilityRole="tablist" accessibilityLabel={t('timeline.label')}>
      {state.sections.map((section, i) => (
        <TouchableOpacity
          key={i}
          accessibilityRole="button"
          accessibilityLabel={t('timeline.goTo', { n: i + 1 })}
          onPress={() => {
            onSelect(i);
          }}
          style={[
            styles.chip,
            { flexGrow: durationOf(section) },
            section.kind === 'color' && 'color' in section
              ? { backgroundColor: section.color }
              : { backgroundColor: withAlpha(colors.primary, 0.1) },
          ]}
        >
          <Ionicons
            name={KIND_ICON[section.kind]}
            size={12}
            color={section.kind === 'color' ? '#fff' : colors.primary}
          />
          <Text style={[styles.chipNum, section.kind === 'color' ? { color: '#fff' } : null]}>{i + 1}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 3, marginBottom: spacing.s },
  chip: {
    flexBasis: 0,
    minWidth: 28,
    minHeight: 30,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  chipNum: { ...typography.smallText, color: colors.primary, fontWeight: '700' },
});
