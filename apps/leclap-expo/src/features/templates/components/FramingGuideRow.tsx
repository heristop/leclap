// Camera framing guide for a video scene: silhouette position (none/left/center/right) + opacity.
// Recording-only — never rendered into the video. Writes section.framingGuide via onChange.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import type { FramingGuide } from '../model/templateEditorModel';

type Choice = 'none' | 'left' | 'center' | 'right';

interface FramingGuideRowProps {
  guide: FramingGuide | undefined;
  t: TFunction<'editor'>;
  onChange: (guide: FramingGuide | undefined) => void;
}

export const FramingGuideRow = ({ guide, t, onChange }: FramingGuideRowProps) => {
  const choice: Choice = guide?.position ?? 'none';
  const opacity = guide?.opacity ?? 0.5;

  const setChoice = (next: Choice) => {
    onChange(next === 'none' ? undefined : { type: 'silhouette', position: next, opacity });
  };

  return (
    <View>
      <Text style={styles.help}>{t('framing.help')}</Text>
      <Segmented<Choice>
        label={t('framing.silhouette')}
        value={choice}
        options={[
          { value: 'none', label: t('framing.off') },
          { value: 'left', label: t('framing.left') },
          { value: 'center', label: t('framing.center') },
          { value: 'right', label: t('framing.right') },
        ]}
        onChange={setChoice}
      />
      {guide ? (
        <Slider
          label={t('framing.opacity')}
          value={opacity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(o) => {
            onChange({ type: 'silhouette', position: guide.position, opacity: o });
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  help: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.s },
});
