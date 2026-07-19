// Lower-third panel for project_video sections — the RN mirror of the web LowerThirdField. A
// title/subtitle band composited over the recorded clip, an optional right-aligned badge, an accent
// colour, a legibility-band colour/opacity and a top/bottom position. Lowers to the descriptor
// `lowerThird` sugar verbatim; clearing title, subtitle and badge removes the band.
// Deliberately mirrors CaptionFields' scope: the web panel's reveal/text-effect controls are skipped
// — no RN reveal or text-effect control exists elsewhere in the app yet, so authoring those stays a
// web-only capability for now.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { Slider, Segmented } from './EditorControls';
import { FieldRow, Toggle, ColorField } from './sceneFields';
import { FEATURE_CONTROLS, type LowerThird } from '../model/templateEditorModel';

const DEFAULT_BAND_COLOR = '#0a0f14';
const DEFAULT_BAND_OPACITY = 0.6;
type Position = NonNullable<LowerThird['position']>;

const POSITION_SPEC = FEATURE_CONTROLS.lowerThird.find((spec) => spec.fieldPath === 'lowerThird.position');
const BAND_SPEC = FEATURE_CONTROLS.lowerThird.find((spec) => spec.fieldPath === 'lowerThird.boxOpacity');

function lineText(line: LowerThird['title']): string {
  return line?.en ?? '';
}

function hasAnyText(band: LowerThird): boolean {
  return [band.title, band.subtitle, band.badge].some((line) => lineText(line).trim() !== '');
}

function nextLowerThird(current: LowerThird | undefined, patch: Partial<LowerThird>): LowerThird | undefined {
  const merged: LowerThird = { ...current, ...patch };

  return hasAnyText(merged) ? merged : undefined;
}

function setLine(value: string): LowerThird['title'] | undefined {
  return value.trim() === '' ? undefined : { en: value };
}

interface LowerThirdFieldsProps {
  value: LowerThird | undefined;
  t: TFunction<'editor'>;
  variables: string[];
  onChange: (value: LowerThird | undefined) => void;
}

export const LowerThirdFields = ({ value, t, variables, onChange }: LowerThirdFieldsProps) => {
  const band = value;

  const patch = (next: Partial<LowerThird>) => {
    onChange(nextLowerThird(band, next));
  };

  return (
    <View>
      <Text style={styles.hint}>{t('lowerThird.hint')}</Text>
      <TextLine
        label={t('lowerThird.title')}
        placeholder={t('lowerThird.titlePlaceholder')}
        value={lineText(band?.title)}
        variables={variables}
        t={t}
        onChange={(v) => {
          patch({ title: setLine(v) });
        }}
      />
      <TextLine
        label={t('lowerThird.subtitle')}
        placeholder={t('lowerThird.subtitlePlaceholder')}
        value={lineText(band?.subtitle)}
        variables={variables}
        t={t}
        onChange={(v) => {
          patch({ subtitle: setLine(v) });
        }}
      />
      <TextLine
        label={t('lowerThird.badge')}
        placeholder={t('lowerThird.badgePlaceholder')}
        value={lineText(band?.badge)}
        variables={variables}
        t={t}
        onChange={(v) => {
          patch({ badge: setLine(v) });
        }}
      />
      {band && hasAnyText(band) ? <LowerThirdOptions band={band} t={t} patch={patch} /> : null}
    </View>
  );
};

// The band-wide options (accent / position / band colour+opacity), shown once the band has any text.
// Split out of LowerThirdFields to keep that component's branching within the complexity budget —
// mirrors the web LowerThirdField.tsx layout.
const LowerThirdOptions = ({
  band,
  t,
  patch,
}: {
  band: LowerThird;
  t: TFunction<'editor'>;
  patch: (next: Partial<LowerThird>) => void;
}) => (
  <View>
    <AccentField
      hint={t('accent.hintLowerThird')}
      accent={band.accent}
      t={t}
      onChange={(accent) => {
        patch({ accent });
      }}
    />
    <Segmented<Position>
      label={t('lowerThird.position')}
      value={band.position ?? 'bottom'}
      options={(POSITION_SPEC?.enumValues ?? []).map((v) => ({
        value: v as Position,
        label: t(`lowerThird.${v}`),
      }))}
      onChange={(next) => {
        patch({ position: next });
      }}
    />
    <ColorField
      label={t('lowerThird.bandColor')}
      value={band.bandColor ?? DEFAULT_BAND_COLOR}
      onChange={(bandColor) => {
        patch({ bandColor });
      }}
    />
    <Slider
      label={t('lowerThird.band')}
      value={band.boxOpacity ?? DEFAULT_BAND_OPACITY}
      min={BAND_SPEC?.min ?? 0}
      max={BAND_SPEC?.max ?? 1}
      step={0.05}
      format={(v) => `${Math.round(v * 100)}%`}
      resetTo={DEFAULT_BAND_OPACITY}
      onChange={(boxOpacity) => {
        patch({ boxOpacity });
      }}
    />
  </View>
);

// The shared accent toggle + colour, reused by titleCard and lowerThird (mirrors the web
// AccentControl's structural — non-geometry — mode: `undefined` means no accent bar; toggling on
// seeds the house brand colour).
const AccentField = ({
  hint,
  accent,
  t,
  onChange,
}: {
  hint: string;
  accent: string | undefined;
  t: TFunction<'editor'>;
  onChange: (accent: string | undefined) => void;
}) => {
  const enabled = accent !== undefined;

  return (
    <View>
      <Toggle
        label={t('accent.enable')}
        value={enabled}
        onChange={(on) => {
          onChange(on ? colors.primary : undefined);
        }}
      />
      {enabled ? <ColorField label={t('accent.color')} value={accent} onChange={onChange} /> : null}
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
};

// One labelled text line — shared by title / subtitle / badge. RN has no in-field `#`-autocomplete
// (the web VariableTextField), so in-scope variables surface as tap-to-insert chips beneath the input,
// mirroring OverlayPositioner's variable row.
const TextLine = ({
  label,
  placeholder,
  value,
  variables,
  t,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  variables: string[];
  t: TFunction<'editor'>;
  onChange: (value: string) => void;
}) => (
  <FieldRow label={label}>
    <>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
      {variables.length > 0 ? (
        <View style={styles.varChips}>
          {variables.map((name) => (
            <TouchableOpacity
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${t('overlay.insertVariable')} ${name}`}
              onPress={() => {
                onChange(`${value}{{ ${name} }}`);
              }}
              style={styles.varChip}
            >
              <Text style={styles.varChipText} numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </>
  </FieldRow>
);

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.s },
  input: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.s,
    paddingVertical: 8,
  },
  varChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  varChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  varChipText: { ...typography.smallText, color: colors.primary },
});
