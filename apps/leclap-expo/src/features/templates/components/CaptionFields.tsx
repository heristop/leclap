// Burned-in caption (a styled title rendered INTO the video) for visual scenes. A text field plus
// position + style segmented controls — mirrors the primary controls of the web CaptionField. Empty
// text clears the whole caption; a non-empty edit merges so position/style survive round-trips.
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { CAPTION_POSITIONS, CAPTION_STYLES } from 'ffmpeg-video-composer/src/schemas/section.schemas.ts';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Segmented } from './EditorControls';
import type { EditorCaption, CaptionPosition, CaptionStyle } from '../model/templateEditorModel';

const DEFAULT_POSITION: CaptionPosition = 'lower-third';
const DEFAULT_STYLE: CaptionStyle = 'bar';

const nextCaption = (current: EditorCaption | undefined, patch: Partial<EditorCaption>): EditorCaption | undefined => {
  const merged = { ...current, ...patch };
  const text = merged.text?.trim() ?? '';

  if (text === '') return undefined;

  return { ...merged, text };
};

interface CaptionFieldsProps {
  caption: EditorCaption | undefined;
  t: TFunction<'editor'>;
  onChange: (caption: EditorCaption | undefined) => void;
}

export const CaptionFields = ({ caption, t, onChange }: CaptionFieldsProps) => {
  const hasText = (caption?.text.trim() ?? '') !== '';

  return (
    <View>
      <TextInput
        style={styles.input}
        value={caption?.text ?? ''}
        placeholder={t('caption.placeholder')}
        placeholderTextColor={colors.textSecondary}
        onChangeText={(text) => {
          onChange(nextCaption(caption, { text }));
        }}
      />
      <Text style={styles.hint}>{t('caption.hint')}</Text>

      {hasText ? (
        <View>
          <Segmented<CaptionPosition>
            label={t('caption.positionLabel')}
            value={caption?.position ?? DEFAULT_POSITION}
            options={CAPTION_POSITIONS.map((value) => ({ value, label: t(`caption.position.${value}`) }))}
            onChange={(position) => {
              onChange(nextCaption(caption, { position }));
            }}
          />
          <Segmented<CaptionStyle>
            label={t('caption.styleLabel')}
            value={caption?.style ?? DEFAULT_STYLE}
            options={CAPTION_STYLES.map((value) => ({ value, label: t(`caption.style.${value}`) }))}
            onChange={(style) => {
              onChange(nextCaption(caption, { style }));
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
