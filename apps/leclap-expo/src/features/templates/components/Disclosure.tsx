// A collapsible advanced-options row: a tappable header (icon + title + chevron) that reveals its
// children. Keeps each scene card tidy — the basics stay visible, the depth is one tap away.
import React, { useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';

interface DisclosureProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const Disclosure = ({ title, icon, defaultOpen = false, children }: DisclosureProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => {
          setOpen((o) => !o);
        }}
        style={styles.header}
      >
        <Ionicons name={icon} size={16} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.divider },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 44 },
  title: { ...typography.button, color: colors.text, flex: 1 },
  body: { paddingBottom: spacing.s },
});
