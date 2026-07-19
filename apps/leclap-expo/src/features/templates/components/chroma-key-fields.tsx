// Background-removal ("chroma key") panel for project_video sections — the RN mirror of the web
// ChromaKeyField. An enable toggle, the screen colour to key out, a similarity ("strength") slider,
// and the solid colour composited behind the keyed clip. Lowers to the descriptor `chromaKey` sugar
// verbatim (build-descriptor's visualExtras passes it straight through). Disabling clears the whole
// object. Deliberately mirrors the web panel's scope: `blend` (edge softness) has no control here
// either — the web panel doesn't expose it, so this doesn't invent one.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider } from './EditorControls';
import { Toggle, ColorField } from './sceneFields';
import { FEATURE_CONTROLS, type ChromaKey } from '../model/templateEditorModel';

const DEFAULT_KEY_COLOR = '#00FF00';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_SIMILARITY = 0.3;

const SIMILARITY_SPEC = FEATURE_CONTROLS.chromaKey.find((spec) => spec.fieldPath === 'chromaKey.similarity');

interface ChromaKeyFieldsProps {
  value: ChromaKey | undefined;
  t: TFunction<'editor'>;
  onChange: (value: ChromaKey | undefined) => void;
}

export const ChromaKeyFields = ({ value, t, onChange }: ChromaKeyFieldsProps) => {
  const enabled = Boolean(value);

  const patch = (next: Partial<ChromaKey>) => {
    onChange({ color: DEFAULT_KEY_COLOR, ...value, ...next });
  };

  return (
    <View>
      <Text style={styles.hint}>{t('chromaKey.hint')}</Text>
      <Toggle
        label={t('chromaKey.enable')}
        value={enabled}
        onChange={(on) => {
          onChange(on ? { color: DEFAULT_KEY_COLOR } : undefined);
        }}
      />
      {enabled && value ? (
        <View>
          <ColorField
            label={t('chromaKey.keyColor')}
            value={value.color}
            onChange={(color) => {
              patch({ color });
            }}
          />
          <ColorField
            label={t('chromaKey.background')}
            value={value.background ?? DEFAULT_BACKGROUND}
            onChange={(background) => {
              patch({ background });
            }}
          />
          <Slider
            label={t('chromaKey.similarity')}
            value={value.similarity ?? DEFAULT_SIMILARITY}
            min={SIMILARITY_SPEC?.min ?? 0.01}
            max={SIMILARITY_SPEC?.max ?? 1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            resetTo={DEFAULT_SIMILARITY}
            onChange={(similarity) => {
              patch({ similarity });
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
