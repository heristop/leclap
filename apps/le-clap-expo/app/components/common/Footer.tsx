import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/src/styles/theme';

interface FooterProps {
  onCreatePress: () => void;
}

const Footer = ({ onCreatePress }: FooterProps) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={onCreatePress}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={24} color={colors.surface} />
        <Text style={styles.createButtonText}>Create New Video</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    minHeight: 56,
  },
  createButtonText: {
    ...typography.button,
    color: colors.surface,
    marginLeft: spacing.s,
  },
});

export default Footer;