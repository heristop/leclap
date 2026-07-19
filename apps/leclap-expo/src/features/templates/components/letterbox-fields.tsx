// Cinemascope-style letterbox bars for a visual scene — the RN mirror of the web LetterboxField.
// An enable toggle, the target aspect ratio (drawn as a slider, "2.39:1"), and the bar colour
// (default black). Lowers to the descriptor `letterbox` sugar verbatim (build-descriptor's
// visualExtras passes it straight through). Disabling clears the whole object.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider } from './EditorControls';
import { Toggle, ColorField } from './sceneFields';
import { FEATURE_CONTROLS, type Letterbox } from '../model/templateEditorModel';

const DEFAULT_ASPECT = 2.39;
const DEFAULT_COLOR = '#000000';

const ASPECT_SPEC = FEATURE_CONTROLS.letterbox.find((spec) => spec.fieldPath === 'letterbox.aspect');

interface LetterboxFieldsProps {
  value: Letterbox | undefined;
  t: TFunction<'editor'>;
  onChange: (value: Letterbox | undefined) => void;
}

export const LetterboxFields = ({ value, t, onChange }: LetterboxFieldsProps) => {
  const enabled = Boolean(value);

  const patch = (next: Partial<Letterbox>) => {
    onChange({ aspect: DEFAULT_ASPECT, ...value, ...next });
  };

  return (
    <View>
      <Text style={styles.hint}>{t('letterbox.hint')}</Text>
      <Toggle
        label={t('letterbox.enable')}
        value={enabled}
        onChange={(on) => {
          onChange(on ? { aspect: DEFAULT_ASPECT } : undefined);
        }}
      />
      {enabled && value ? (
        <View>
          <Slider
            label={t('letterbox.aspect')}
            value={value.aspect}
            min={ASPECT_SPEC?.min ?? 1}
            max={ASPECT_SPEC?.max ?? 4}
            step={0.01}
            format={(v) => `${v.toFixed(2)}:1`}
            resetTo={DEFAULT_ASPECT}
            onChange={(aspect) => {
              patch({ aspect });
            }}
          />
          <ColorField
            label={t('letterbox.color')}
            value={value.color ?? DEFAULT_COLOR}
            onChange={(color) => {
              patch({ color });
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.s },
});
