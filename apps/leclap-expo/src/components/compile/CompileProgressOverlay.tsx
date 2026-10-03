import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useCompileProgressStore } from '@/src/stores/useCompileProgressStore';
import { Clappy } from '@/src/components/clappy/Clappy';
import { colors, spacing, typography, withAlpha } from '@/src/styles/theme';

/** Real engine progress; Clappy stays still while rendering so feedback remains calm. */
export function CompileProgressOverlay() {
  const { t } = useTranslation('preview');
  const visible = useCompileProgressStore((s) => s.visible);
  const ratio = useCompileProgressStore((s) => s.ratio);
  const stage = useCompileProgressStore((s) => s.stage);
  const cancelling = useCompileProgressStore((s) => s.cancelling);
  const requestCancel = useCompileProgressStore((s) => s.requestCancel);
  const reduced = useReducedMotion();
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.value = reduced ? ratio : withTiming(ratio, { duration: 180 });
  }, [ratio, reduced, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const percent = Math.round(ratio * 100);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.center}>
          <Clappy size={180} state="working" />
          <Text accessibilityRole="header" style={styles.heading}>
            {t('compile.title')}
          </Text>
          <Text style={styles.percent}>{percent}%</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('compile.progress')}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={styles.track}
          >
            <Animated.View style={[styles.bar, barStyle]} />
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.stage}>
            {cancelling ? t('compile.cancelling') : stage || t('compile.preparing')}
          </Text>
          <View style={styles.privacy}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.monitorSecondary} accessible={false} />
            <Text style={styles.privacyText}>{t('compile.private')}</Text>
          </View>
          <Pressable
            onPress={requestCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel={t('compile.cancel')}
            accessibilityState={{ disabled: cancelling, busy: cancelling }}
            style={({ pressed }) => [styles.cancel, cancelling && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>{cancelling ? t('compile.cancelling') : t('compile.cancel')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.monitorBackground },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.l, gap: spacing.m },
  heading: { ...typography.displayS, color: colors.monitorText, textAlign: 'center', marginTop: spacing.s },
  percent: { ...typography.displayL, color: colors.monitorText, fontVariant: ['tabular-nums'] },
  track: {
    width: '100%',
    maxWidth: 280,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.monitorText, 0.15),
  },
  bar: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  stage: { ...typography.body, color: colors.monitorSecondary, lineHeight: 24, textAlign: 'center', minHeight: 48 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m, maxWidth: 320 },
  privacyText: { ...typography.caption, color: colors.monitorSecondary, lineHeight: 20, flexShrink: 1 },
  cancel: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.monitorText, 0.1),
  },
  cancelText: { ...typography.body, color: colors.monitorText, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: withAlpha(colors.monitorText, 0.2) },
});
export default CompileProgressOverlay;
