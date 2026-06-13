import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '@/src/styles/theme';
import { isServerOptionEnabled } from '@/src/config/runtime';
import { useCompileMode, useSetCompileMode, type CompileMode } from '@/src/stores/useSettingsStore';

const MODES: { value: CompileMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: 'local',
    icon: 'phone-portrait-outline',
  },
  {
    value: 'server',
    icon: 'cloud-outline',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation('settings');
  const mode = useCompileMode();
  const setMode = useSetCompileMode();
  const serverEnabled = isServerOptionEnabled();

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }
    router.replace('/');
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.iconBtn} accessibilityLabel={t('close')}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>{t('compilation.label')}</Text>
        <Text style={styles.sectionCaption}>{t('compilation.caption')}</Text>

        {!serverEnabled && (
          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
            <Text style={styles.noticeText}>{t('onDeviceNotice')}</Text>
          </View>
        )}

        {serverEnabled && (
          <View style={styles.segment}>
            {MODES.map((m) => {
              const active = mode === m.value;

              return (
                <Pressable
                  key={m.value}
                  onPress={() => {
                    setMode(m.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                    <Ionicons name={m.icon} size={20} color={active ? '#fff' : colors.primary} />
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {t(`modes.${m.value}.label`)}
                    </Text>
                    <Text style={styles.optionHint}>{t(`modes.${m.value}.hint`)}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? colors.primary : colors.divider}
                  />
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>{serverEnabled ? t('footnote.enabled') : t('footnote.disabled')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s,
    paddingTop: spacing.xl,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.subtitle, color: colors.text },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.l },
  sectionLabel: { ...typography.smallText, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCaption: { ...typography.body, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.m },
  segment: { gap: spacing.s },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.m,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: 'rgba(124,131,253,0.06)' },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,131,253,0.10)',
  },
  optionIconActive: { backgroundColor: colors.primary },
  optionBody: { flex: 1 },
  optionLabel: { ...typography.button, color: colors.text },
  optionLabelActive: { color: colors.primary },
  optionHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.m,
    borderRadius: 14,
    backgroundColor: 'rgba(63,178,127,0.10)',
  },
  noticeText: { ...typography.caption, color: colors.text, flex: 1 },
  footnote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.l, lineHeight: 18 },
});
