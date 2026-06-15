// Camera framing guide for a video scene: silhouette position (none/left/center/right), a
// bust/outline style toggle, and opacity. Recording-only — never rendered into the video.
// Writes section.framingGuide via onChange.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import { DEFAULT_FRAMING_OPACITY, type FramingGuide } from '../model/templateEditorModel';

type Position = 'left' | 'center' | 'right';
type Choice = 'none' | Position;
type Style = 'bust' | 'outline';

// 'bust' is the default, so it is omitted from the descriptor to keep stored templates minimal.
const buildGuide = (position: Position, opacity: number, style: Style): FramingGuide => ({
  type: 'silhouette',
  position,
  opacity,
  ...(style === 'bust' ? {} : { style }),
});

interface FramingGuideRowProps {
  guide: FramingGuide | undefined;
  t: TFunction<'editor'>;
  onChange: (guide: FramingGuide | undefined) => void;
}

export const FramingGuideRow = ({ guide, t, onChange }: FramingGuideRowProps) => {
  const choice: Choice = guide?.position ?? 'none';
  const opacity = guide?.opacity ?? DEFAULT_FRAMING_OPACITY;
  const style: Style = guide?.style ?? 'bust';

  const setChoice = (next: Choice) => {
    onChange(next === 'none' ? undefined : buildGuide(next, opacity, style));
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
        <>
          <Segmented<Style>
            label={t('framing.style')}
            value={style}
            options={[
              { value: 'bust', label: t('framing.styleBust') },
              { value: 'outline', label: t('framing.styleOutline') },
            ]}
            onChange={(s) => {
              onChange(buildGuide(guide.position, opacity, s));
            }}
          />
          <Slider
            label={t('framing.opacity')}
            value={opacity}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(o) => {
              onChange(buildGuide(guide.position, o, style));
            }}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  help: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.s },
});
