// Kind-specific "basics" for a scene card (duration, mute, title, colour, form fields, media) plus
// the small shared field primitives and styles. Split out of SceneCard to keep both files focused.
// Every edit goes up via onChange (patchSection) — this never mutates EditorState.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';
import { MediaPicker } from './MediaPicker';
import { PartialFields } from './PartialFields';
import type { EditorSection } from '../model/templateEditorModel';

const toggleId = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

interface SceneBasicsProps {
  index: number;
  section: EditorSection;
  t: TFunction<'editor'>;
  defaultCountdownSeconds: (duration: number) => number;
  onChange: (p: Partial<EditorSection>) => void;
  onEditOverlay: () => void;
}

export const SceneBasics = ({
  index,
  section,
  t,
  defaultCountdownSeconds,
  onChange,
  onEditOverlay,
}: SceneBasicsProps) => {
  if (section.kind === 'video') {
    const primaryText = section.overlays.length > 0 ? section.overlays[0].text.trim() : '';

    return (
      <View>
        <FieldRow label={t('section.duration')}>
          <NumberInput
            value={section.duration}
            onChange={(duration) => {
              if (section.countdown && !section.countdownCustomized) {
                onChange({ duration, countdownSeconds: defaultCountdownSeconds(duration) });

                return;
              }

              onChange({ duration });
            }}
          />
        </FieldRow>
        <Toggle
          label={t('section.mute')}
          value={section.mute}
          onChange={(mute) => {
            onChange({ mute });
          }}
        />
        <FieldRow label={t('section.whatToFilm')}>
          <TextInput
            style={styles.inputSm}
            value={section.description ?? ''}
            onChangeText={(text) => {
              onChange({ description: text.trim() === '' ? undefined : text });
            }}
            placeholder={t('section.whatToFilmPlaceholder')}
            placeholderTextColor={colors.textSecondary}
          />
        </FieldRow>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('section.editTitle')}
          testID={`section-${index}-overlay`}
          onPress={onEditOverlay}
          style={styles.overlayBtn}
        >
          <Ionicons name="text-outline" size={16} color={colors.primary} />
          <Text style={styles.overlayBtnText} numberOfLines={1}>
            {primaryText === '' ? t('section.addTitle') : primaryText}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Toggle
          label={t('section.countdownToggle')}
          testID={`section-${index}-countdown`}
          value={section.countdown}
          onChange={(countdown) => {
            if (countdown) {
              onChange({
                countdown,
                countdownSeconds: defaultCountdownSeconds(section.duration),
                countdownCustomized: false,
              });

              return;
            }

            onChange({ countdown });
          }}
        />
        {section.countdown ? (
          <FieldRow label={t('section.countdown')}>
            <NumberInput
              value={section.countdownSeconds}
              onChange={(countdownSeconds) => {
                onChange({ countdownSeconds, countdownCustomized: true });
              }}
            />
          </FieldRow>
        ) : null}
      </View>
    );
  }

  if (section.kind === 'color') {
    return (
      <View>
        <FieldRow label={t('section.duration')}>
          <NumberInput
            value={section.duration}
            onChange={(duration) => {
              onChange({ duration });
            }}
          />
        </FieldRow>
        <FieldRow label={t('color.label')}>
          <View style={styles.colorRow}>
            <View style={[styles.swatch, { backgroundColor: section.color }]} />
            <TextInput
              style={[styles.inputSm, { flex: 1 }]}
              value={section.color}
              autoCapitalize="none"
              onChangeText={(color) => {
                onChange({ color });
              }}
              placeholder={t('color.placeholder')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </FieldRow>
      </View>
    );
  }

  if (section.kind === 'form') {
    return (
      <View>
        {section.fields.map((f, fi) => (
          <FieldRow key={fi} label={t('field.label', { n: fi + 1 })}>
            <View style={styles.colorRow}>
              <TextInput
                style={[styles.inputSm, { flex: 1 }]}
                value={f.label}
                onChangeText={(label) => {
                  onChange({ fields: section.fields.map((x, idx) => (idx === fi ? { ...x, label } : x)) });
                }}
                placeholder={t('field.placeholder')}
                placeholderTextColor={colors.textSecondary}
              />
              {section.fields.length > 1 ? (
                <IconBtn
                  icon="close"
                  tint={colors.error}
                  onPress={() => {
                    onChange({ fields: section.fields.filter((_, idx) => idx !== fi) });
                  }}
                />
              ) : null}
            </View>
          </FieldRow>
        ))}
        <TouchableOpacity
          onPress={() => {
            onChange({
              fields: [...section.fields, { name: `field_${section.fields.length + 1}`, label: '', maxLength: 40 }],
            });
          }}
          style={styles.addInline}
        >
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={styles.addInlineText}>{t('field.add')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (section.kind === 'music') {
    return (
      <View>
        <Text style={styles.fieldLabel}>{t('music.pick')}</Text>
        <MediaPicker
          kind="music"
          selectedIds={section.allowed}
          onToggleId={(id) => {
            onChange({ allowed: toggleId(section.allowed, id) });
          }}
        />
        <Toggle
          label={t('music.allowUpload')}
          testID={`section-${index}-allow-upload`}
          value={section.allowUpload}
          onChange={(allowUpload) => {
            onChange({ allowUpload });
          }}
        />
      </View>
    );
  }

  // A partial inserts a reusable fragment (expanded at compile time): pick which one and override its
  // variables.
  if (section.kind === 'partial') {
    return <PartialFields refId={section.ref} variables={section.variables} t={t} onChange={onChange} />;
  }

  return (
    <View>
      <FieldRow label={t('section.duration')}>
        <NumberInput
          value={section.duration}
          onChange={(duration) => {
            onChange({ duration });
          }}
        />
      </FieldRow>
      <Text style={styles.fieldLabel}>{t('image.pick')}</Text>
      <MediaPicker
        kind="picture"
        selectedIds={section.allowed}
        onToggleId={(id) => {
          onChange({ allowed: toggleId(section.allowed, id) });
        }}
      />
      <Toggle
        label={t('image.allowUpload')}
        testID={`section-${index}-allow-upload`}
        value={section.allowUpload}
        onChange={(allowUpload) => {
          onChange({ allowUpload });
        }}
      />
    </View>
  );
};

export const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ marginTop: spacing.s }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

export const Toggle = ({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) => (
  <View style={styles.rowBetween}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Switch
      testID={testID}
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.primary, false: colors.divider }}
      thumbColor="#fff"
    />
  </View>
);

export const NumberInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <TextInput
    style={styles.inputSm}
    value={String(value)}
    keyboardType="number-pad"
    onChangeText={(t) => {
      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
      onChange(Number.isNaN(n) ? 0 : n);
    }}
  />
);

export const IconBtn = ({
  icon,
  onPress,
  disabled,
  tint,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
  testID?: string;
}) => (
  <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} style={styles.iconBtnSm}>
    <Ionicons name={icon} size={18} color={disabled ? colors.divider : (tint ?? colors.textSecondary)} />
  </TouchableOpacity>
);

export const sceneStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.m,
    marginTop: spacing.s,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flex: 1 },
  numberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,131,253,0.15)',
  },
  numberBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cardTitleText: { ...typography.button, color: colors.text },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  iconBtnSm: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...typography.smallText, color: colors.textSecondary, marginBottom: spacing.xs, flexShrink: 1 },
  inputSm: {
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.m,
    gap: spacing.s,
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.divider },
  overlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: 44,
    marginTop: spacing.s,
    paddingHorizontal: spacing.s,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  overlayBtnText: { ...typography.caption, color: colors.text, flex: 1 },
  addInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.m,
    marginTop: spacing.s,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(124,131,253,0.08)',
  },
  addInlineText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
