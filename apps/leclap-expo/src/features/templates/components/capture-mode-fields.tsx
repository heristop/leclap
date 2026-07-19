// Capture-source picker for a project_video section: which recorder inputs the end-user may use
// (front/back camera, screen recording, file upload) and which one the recorder opens on. Pure
// recorder metadata honoured by both capture UIs (web CameraCapture/StepClip, expo VideoRecorder) —
// never rendered into the video. The selection logic lives in capture-modes.ts (shared, tested).
// Mirrors the web CaptureModeField.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Segmented } from './EditorControls';
import {
  ALL_CAPTURE_MODES,
  type CaptureMode,
  type CaptureSelection,
  allowedSetFrom,
  effectiveModeFrom,
  toggleAllowedMode,
  pickDefaultMode,
} from '../model/templateEditorModel';

interface CaptureModeFieldsProps {
  selection: CaptureSelection;
  t: TFunction<'editor'>;
  onChange: (next: CaptureSelection) => void;
}

export const CaptureModeFields = ({ selection, t, onChange }: CaptureModeFieldsProps) => {
  const allowed = allowedSetFrom(selection.allowedCaptureModes);
  const effective = effectiveModeFrom(selection);

  return (
    <View>
      <Text style={styles.hint}>{t('capture.hint')}</Text>
      <Text style={styles.groupLabel}>{t('capture.allowedLabel')}</Text>
      <View style={styles.chipRow}>
        {ALL_CAPTURE_MODES.map((mode) => {
          const active = allowed.includes(mode);

          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`capture.mode.${mode}`)}
              onPress={() => {
                onChange(toggleAllowedMode(selection, mode));
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              {active ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`capture.mode.${mode}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {allowed.length > 1 ? (
        <Segmented<CaptureMode>
          label={t('capture.defaultLabel')}
          value={effective}
          options={allowed.map((mode) => ({ value: mode, label: t(`capture.mode.${mode}`) }))}
          onChange={(mode) => {
            onChange(pickDefaultMode(selection, mode));
          }}
        />
      ) : null}
      {allowed.length === 1 ? <Text style={styles.hint}>{t('capture.lockedNote')}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.s },
  groupLabel: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.s,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(124,131,253,0.1)' },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
});
