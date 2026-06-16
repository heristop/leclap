// Editing for a `partial` section: pick which reusable fragment to insert, then override its
// `{{ key }}` variables. The expo editor previously rendered nothing for partial sections, so they
// were addable but inert — this mirrors the web PartialFields (built-in catalog only on device).
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { APP_PARTIALS } from '@leclap/creative-kit/partials';
import { colors, spacing, typography } from '@/src/styles/theme';
import type { EditorSection } from '../model/templateEditorModel';

type Variable = { name: string; value: string };

interface PartialFieldsProps {
  refId: string;
  variables: Variable[];
  t: TFunction<'editor'>;
  onChange: (patch: Partial<EditorSection>) => void;
}

const overrideFor = (variables: Variable[], name: string, fallback: string): string =>
  variables.find((v) => v.name === name)?.value ?? fallback;

const withVariable = (variables: Variable[], name: string, value: string): Variable[] => [
  ...variables.filter((v) => v.name !== name),
  { name, value },
];

export const PartialFields = ({ refId, variables, t, onChange }: PartialFieldsProps) => {
  const selected = APP_PARTIALS.find((p) => p.id === refId);
  const defaults = selected?.variables ?? {};

  return (
    <View>
      <Text style={styles.label}>{t('partial.pick')}</Text>
      {APP_PARTIALS.map((partial) => {
        const active = partial.id === refId;

        return (
          <TouchableOpacity
            key={partial.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              // Switching partials clears stale overrides — the new fragment has its own variables.
              onChange({ ref: partial.id, variables: [] });
            }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{partial.id}</Text>
            <Text style={styles.optionDesc} numberOfLines={2}>
              {partial.description}
            </Text>
          </TouchableOpacity>
        );
      })}

      {selected && Object.keys(defaults).length > 0 ? (
        <View style={styles.variables}>
          <Text style={styles.label}>{t('partial.variables')}</Text>
          {Object.entries(defaults).map(([name, fallback]) => (
            <View key={name} style={styles.varRow}>
              <Text style={styles.varName} numberOfLines={1}>
                {name}
              </Text>
              <TextInput
                style={styles.varInput}
                value={overrideFor(variables, name, fallback)}
                placeholder={fallback}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                onChangeText={(value) => {
                  onChange({ variables: withVariable(variables, name, value) });
                }}
              />
            </View>
          ))}
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
  option: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: spacing.s,
    marginBottom: spacing.xs,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  optionTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  optionTitleActive: { color: colors.primary },
  optionDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  variables: { marginTop: spacing.s },
  varRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  varName: { ...typography.smallText, color: colors.textSecondary, width: 96 },
  varInput: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
});
