// Per-section audio for a visual scene: a music-volume override (falls back to the global mix when
// cleared) and optional fade-in / fade-out with an AFADE curve. Writes section.musicVolume and
// section.audioFade via onChange (patchSection). AFADE_CURVES is imported from the core, never hardcoded.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { AFADE_CURVES } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import { Slider } from './EditorControls';
import type { EditorSection, SectionAudioFade, AudioFadeSide } from '../model/templateEditorModel';

type FadeSide = 'in' | 'out';

interface SectionAudioFieldsProps {
  musicVolume: number | undefined;
  audioFade: SectionAudioFade | undefined;
  t: TFunction<'editor'>;
  onChange: (p: Partial<EditorSection>) => void;
}

export const SectionAudioFields = ({ musicVolume, audioFade, t, onChange }: SectionAudioFieldsProps) => {
  // Rebuild the fade keeping only the sides that remain; an empty fade clears the whole key
  // (passed as `undefined` so patchSection's Partial merge actually removes it).
  const patchFade = (side: FadeSide, next: AudioFadeSide | undefined) => {
    const merged: SectionAudioFade = { ...audioFade, [side]: next };
    const rebuilt: SectionAudioFade = {};

    if (merged.in) rebuilt.in = merged.in;

    if (merged.out) rebuilt.out = merged.out;

    if (!rebuilt.in && !rebuilt.out) {
      onChange({ audioFade: undefined });

      return;
    }

    onChange({ audioFade: rebuilt });
  };

  const usesGlobal = musicVolume === undefined;

  return (
    <View>
      <View style={styles.volHeader}>
        <Text style={styles.label}>{usesGlobal ? t('audio.musicVolumeGlobal') : t('audio.musicVolume')}</Text>
        {usesGlobal ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('audio.resetGlobal')}
            onPress={() => {
              onChange({ musicVolume: undefined });
            }}
            style={styles.resetBtn}
          >
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <Slider
        label=""
        value={musicVolume ?? 0.5}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => {
          onChange({ musicVolume: v });
        }}
      />

      <FadeSideRow
        t={t}
        label={t('audio.fadeIn')}
        value={audioFade?.in}
        onChange={(next) => {
          patchFade('in', next);
        }}
      />
      <FadeSideRow
        t={t}
        label={t('audio.fadeOut')}
        value={audioFade?.out}
        onChange={(next) => {
          patchFade('out', next);
        }}
      />
    </View>
  );
};

interface FadeSideRowProps {
  label: string;
  value: AudioFadeSide | undefined;
  t: TFunction<'editor'>;
  onChange: (next: AudioFadeSide | undefined) => void;
}

const FadeSideRow = ({ label, value, t, onChange }: FadeSideRowProps) => {
  const enabled = Boolean(value);

  return (
    <View style={styles.fadeRow}>
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel={label}
        onPress={() => {
          onChange(enabled ? undefined : { duration: 0.5 });
        }}
        style={styles.fadeToggle}
      >
        <Ionicons
          name={enabled ? 'checkbox' : 'square-outline'}
          size={20}
          color={enabled ? colors.primary : colors.textSecondary}
        />
        <Text style={styles.fadeLabel}>{label}</Text>
      </TouchableOpacity>

      {enabled && value ? (
        <View>
          <Slider
            label={t('audio.duration')}
            value={value.duration}
            min={0.1}
            max={5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(duration) => {
              onChange({ duration, curve: value.curve });
            }}
          />
          <Text style={styles.label}>{t('audio.curve')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.curveRow}>
            {AFADE_CURVES.map((curve) => {
              const active = (value.curve ?? 'tri') === curve;

              return (
                <TouchableOpacity
                  key={curve}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Curve ${curve}`}
                  onPress={() => {
                    onChange({ duration: value.duration, curve });
                  }}
                  style={[styles.curveChip, active && styles.curveChipActive]}
                >
                  <Text style={[styles.curveText, active && styles.curveTextActive]}>{curve}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  volHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fadeRow: { marginTop: spacing.m },
  fadeToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 44 },
  fadeLabel: { ...typography.body, color: colors.text },
  curveRow: { gap: spacing.xs, paddingRight: spacing.m },
  curveChip: {
    minHeight: 36,
    paddingHorizontal: spacing.m,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  curveChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  curveText: { ...typography.caption, color: colors.textSecondary },
  curveTextActive: { color: '#fff', fontWeight: '600' },
});
