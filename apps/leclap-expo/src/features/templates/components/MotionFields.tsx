// Motion for image / video scenes: a toggle, a kind picker (Ken Burns / handheld shake / zoom pulse —
// the effects-pack's shake and pulse joined the original kenburns-only MVP here), and that kind's
// controls. Always writes a single-element motion list (or undefined when off) via onChange —
// mirroring the web MotionPanel's single-effect scope (rotate/flip/crop stay web-only for now).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import type { MotionEffect } from '../model/templateEditorModel';

type Direction = 'in' | 'out' | 'left' | 'right' | 'up' | 'down';
type MotionKind = 'kenburns' | 'shake' | 'pulse';

const DEFAULT_INTENSITY = 1.15;
const DEFAULT_SHAKE_INTENSITY = 6;
const DEFAULT_SHAKE_FREQUENCY = 2;
const DEFAULT_PULSE_INTENSITY = 1.08;
const DEFAULT_PULSE_FREQUENCY = 1;

interface MotionFieldsProps {
  motion: MotionEffect[] | undefined;
  t: TFunction<'editor'>;
  onChange: (motion: MotionEffect[] | undefined) => void;
}

type KenBurns = Extract<MotionEffect, { type: 'kenburns' }>;
type Shake = Extract<MotionEffect, { type: 'shake' }>;
type Pulse = Extract<MotionEffect, { type: 'pulse' }>;

// The single effect this screen edits, restricted to the three kinds it manages — an effect of any
// other type (rotate/flip/crop, web-only today) reads as disabled rather than crashing the picker.
function activeEffect(motion: MotionEffect[] | undefined): KenBurns | Shake | Pulse | null {
  const effect = motion?.[0];

  if (effect?.type === 'kenburns' || effect?.type === 'shake' || effect?.type === 'pulse') return effect;

  return null;
}

function defaultForKind(kind: MotionKind): MotionEffect {
  if (kind === 'shake') {
    return { type: 'shake', intensity: DEFAULT_SHAKE_INTENSITY, frequency: DEFAULT_SHAKE_FREQUENCY };
  }

  if (kind === 'pulse') {
    return { type: 'pulse', intensity: DEFAULT_PULSE_INTENSITY, frequency: DEFAULT_PULSE_FREQUENCY };
  }

  return { type: 'kenburns', direction: 'in', intensity: DEFAULT_INTENSITY };
}

export const MotionFields = ({ motion, t, onChange }: MotionFieldsProps) => {
  const effect = activeEffect(motion);
  const enabled = effect !== null;

  const write = (next: MotionEffect | null) => {
    onChange(next ? [next] : undefined);
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
          write(v === 'on' ? (effect ?? defaultForKind('kenburns')) : null);
        }}
      />

      {effect ? (
        <View>
          <Text style={styles.label}>{t('motion.kind')}</Text>
          <Segmented<MotionKind>
            value={effect.type}
            options={[
              { value: 'kenburns', label: t('motion.kindKenburns') },
              { value: 'shake', label: t('motion.kindShake') },
              { value: 'pulse', label: t('motion.kindPulse') },
            ]}
            onChange={(kind) => {
              write(kind === effect.type ? effect : defaultForKind(kind));
            }}
          />
          <EffectFields effect={effect} t={t} onChange={write} />
        </View>
      ) : null}
    </View>
  );
};

const EffectFields = ({
  effect,
  t,
  onChange,
}: {
  effect: KenBurns | Shake | Pulse;
  t: TFunction<'editor'>;
  onChange: (effect: MotionEffect) => void;
}) => {
  if (effect.type === 'kenburns') {
    const direction: Direction = effect.direction ?? 'in';
    const intensity = effect.intensity ?? DEFAULT_INTENSITY;

    return (
      <View>
        <Text style={styles.label}>{t('motion.direction')}</Text>
        <Segmented<Direction>
          value={direction}
          options={[
            { value: 'in', label: t('motion.in') },
            { value: 'out', label: t('motion.out') },
            { value: 'left', label: t('motion.left') },
            { value: 'right', label: t('motion.right') },
          ]}
          onChange={(next) => {
            onChange({ ...effect, direction: next });
          }}
        />
        <Segmented<Direction>
          value={direction}
          options={[
            { value: 'up', label: t('motion.up') },
            { value: 'down', label: t('motion.down') },
          ]}
          onChange={(next) => {
            onChange({ ...effect, direction: next });
          }}
        />
        <Slider
          label={t('motion.intensity')}
          value={intensity}
          min={1.01}
          max={2}
          step={0.01}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(next) => {
            onChange({ ...effect, intensity: next });
          }}
        />
      </View>
    );
  }

  if (effect.type === 'shake') {
    return (
      <View>
        <Slider
          label={t('motion.shakeIntensity')}
          value={effect.intensity ?? DEFAULT_SHAKE_INTENSITY}
          min={1}
          max={20}
          step={1}
          format={(v) => `${v}px`}
          onChange={(intensity) => {
            onChange({ ...effect, intensity });
          }}
        />
        <Slider
          label={t('motion.shakeFrequency')}
          value={effect.frequency ?? DEFAULT_SHAKE_FREQUENCY}
          min={0.5}
          max={8}
          step={0.1}
          format={(v) => `${v.toFixed(1)}Hz`}
          onChange={(frequency) => {
            onChange({ ...effect, frequency });
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Slider
        label={t('motion.pulseIntensity')}
        value={effect.intensity ?? DEFAULT_PULSE_INTENSITY}
        min={1.01}
        max={1.3}
        step={0.01}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(intensity) => {
          onChange({ ...effect, intensity });
        }}
      />
      <Slider
        label={t('motion.pulseFrequency')}
        value={effect.frequency ?? DEFAULT_PULSE_FREQUENCY}
        min={0.25}
        max={4}
        step={0.05}
        format={(v) => `${v.toFixed(2)}/s`}
        onChange={(frequency) => {
          onChange({ ...effect, frequency });
        }}
      />
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
