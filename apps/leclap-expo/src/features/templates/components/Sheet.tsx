// A bottom sheet built on RN Modal (no @gorhom/bottom-sheet in the app). Dismissible via the
// backdrop, the grab handle's close button, or the hardware back button. Content scrolls.
import React, { type ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '@/src/styles/theme';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const Sheet = ({ visible, title, onClose, children }: SheetProps) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation('preview');

  return (
    <Modal visible={visible} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose} accessibilityLabel={t('sheet.dismiss')}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.m) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('sheet.close')}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.divider,
    marginTop: spacing.s,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.s,
  },
  title: { ...typography.subtitle, color: colors.text, flex: 1 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.l },
});
