// Playback-speed control for visual sections: a slider over friendly rate stops (0.25x-4x) that
// writes the descriptor's options.speed (a PTS multiplier - the inversion lives in speed-rate.ts,
// tested). Mirrors the web SpeedField.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider } from './EditorControls';
import {
  RATE_STOPS,
  NORMAL_RATE_INDEX,
  rateFromSpeed,
  speedFromRate,
  nearestRateIndex,
  formatRate,
} from '../model/templateEditorModel';

interface SpeedFieldProps {
  speed: number | undefined;
  t: TFunction<'editor'>;
  onChange: (speed: number | undefined) => void;
}

export const SpeedField = ({ speed, t, onChange }: SpeedFieldProps) => {
  const index = nearestRateIndex(rateFromSpeed(speed));

  return (
    <View>
      <Slider
        label={t('speed.label')}
        value={index}
        min={0}
        max={RATE_STOPS.length - 1}
        step={1}
        format={(i) => formatRate(RATE_STOPS[i])}
        resetTo={NORMAL_RATE_INDEX}
        onChange={(i) => {
          onChange(speedFromRate(RATE_STOPS[i]));
        }}
      />
      {index === NORMAL_RATE_INDEX ? null : <Text style={styles.hint}>{t('speed.hint')}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
