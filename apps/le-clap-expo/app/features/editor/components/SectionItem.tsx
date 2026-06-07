import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Section } from '@/src/types';
import { colors, spacing, typography } from '@/src/styles/theme';

interface SectionItemProps {
  section: Section;
  isActive: boolean;
  isCompleted: boolean;
  onPress: () => void;
}

const SectionItem: React.FC<SectionItemProps> = ({ section, isActive, isCompleted, onPress }) => {
  const getIconName = () => {
    switch (section.type) {
      case 'project_video':
        return 'videocam-outline';
      case 'form':
        return 'document-text-outline';
      case 'music':
        return 'musical-notes-outline';
      default:
        return 'document-outline';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, isActive && styles.activeContainer]}
    >
      <View
        style={[styles.statusIndicator, isCompleted && styles.completedIndicator, isActive && styles.activeIndicator]}
      >
        <Ionicons
          name={isCompleted ? 'checkmark' : getIconName()}
          size={16}
          color={isCompleted || isActive ? 'white' : colors.textSecondary}
        />
      </View>
      <Text style={[styles.title, isActive && styles.activeTitle]} numberOfLines={1}>
        {section.title?.en ?? section.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 150,
  },
  activeContainer: {
    backgroundColor: colors.primary,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
  },
  completedIndicator: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  activeIndicator: {
    borderColor: colors.surface,
  },
  title: {
    ...typography.body,
    flex: 1,
  },
  activeTitle: {
    color: colors.surface,
  },
});

export default SectionItem;
