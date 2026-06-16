// Ken Burns motion for image / video scenes: a toggle, a direction, and an intensity slider.
// Always writes a single-element [{ type:'kenburns', direction, intensity }] (or undefined when
// off) via onChange — mirroring the web MotionPanel, which only manages the one kenburns effect.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import type { MotionEffect } from '../model/templateEditorModel';

type Direction = 'in' | 'out' | 'left' | 'right' | 'up' | 'down';

const DEFAULT_INTENSITY = 1.15;

interface MotionFieldsProps {
  motion: MotionEffect[] | undefined;
  t: TFunction<'editor'>;
  onChange: (motion: MotionEffect[] | undefined) => void;
}

type KenBurns = Extract<MotionEffect, { type: 'kenburns' }>;

const readKenburns = (motion: MotionEffect[] | undefined): { direction: Direction; intensity: number } | null => {
  const effect = motion?.find((m): m is KenBurns => m.type === 'kenburns');

  if (!effect) return null;

  return { direction: effect.direction ?? 'in', intensity: effect.intensity ?? DEFAULT_INTENSITY };
};

export const MotionFields = ({ motion, t, onChange }: MotionFieldsProps) => {
  const current = readKenburns(motion);
  const enabled = current !== null;

  const write = (next: { direction: Direction; intensity: number } | null) => {
    onChange(next ? [{ type: 'kenburns', direction: next.direction, intensity: next.intensity }] : undefined);
  };

  return (
    <View>
      <Segmented
        label={t('motion.kenburns')}
        value={enabled ? 'on' : 'off'}
        options={[
          { value: 'off', label: t('motion.off') },
          { value: 'on', label: t('motion.on') },
        ]}
        onChange={(v) => {
          write(v === 'on' ? (current ?? { direction: 'in', intensity: DEFAULT_INTENSITY }) : null);
        }}
      />

      {current ? (
        <View>
          <Text style={styles.label}>{t('motion.direction')}</Text>
          <Segmented<Direction>
            value={current.direction}
            options={[
              { value: 'in', label: t('motion.in') },
              { value: 'out', label: t('motion.out') },
              { value: 'left', label: t('motion.left') },
              { value: 'right', label: t('motion.right') },
            ]}
            onChange={(direction) => {
              write({ direction, intensity: current.intensity });
            }}
          />
          <Segmented<Direction>
            value={current.direction}
            options={[
              { value: 'up', label: t('motion.up') },
              { value: 'down', label: t('motion.down') },
            ]}
            onChange={(direction) => {
              write({ direction, intensity: current.intensity });
            }}
          />
          <Slider
            label={t('motion.intensity')}
            value={current.intensity}
            min={1.01}
            max={2}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(intensity) => {
              write({ direction: current.direction, intensity });
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.smallText,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
});
