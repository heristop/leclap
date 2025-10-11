import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../../providers/OfflineProvider';
import { colors, spacing, typography } from '../../styles/theme';

interface NetworkStatusIndicatorProps {
  showWhenOnline?: boolean;
  compact?: boolean;
}

export function NetworkStatusIndicator({
  showWhenOnline = false,
  compact = false
}: NetworkStatusIndicatorProps) {
  const { isOnline, isOffline, networkType } = useOffline();

  // Don't show when online unless explicitly requested
  if (isOnline && !showWhenOnline) {
    return null;
  }

  const getStatusColor = () => {
    if (isOnline) return colors.success;
    return colors.error;
  };

  const getStatusIcon = () => {
    if (isOnline) return 'wifi' as const;
    return 'wifi-off' as const;
  };

  const getStatusText = () => {
    if (isOnline) {
      return compact ? 'Online' : `Online (${networkType || 'Unknown'})`;
    }
    return compact ? 'Offline' : 'No internet connection';
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Ionicons
        name={getStatusIcon()}
        size={compact ? 16 : 20}
        color={getStatusColor()}
        style={styles.icon}
      />
      <Text style={[
        styles.text,
        { color: getStatusColor() },
        compact && styles.textCompact
      ]}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
  },
  containerCompact: {
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.s,
    marginVertical: spacing.xs,
  },
  icon: {
    marginRight: spacing.s,
  },
  text: {
    ...typography.caption,
    fontWeight: '500',
  },
  textCompact: {
    fontSize: 12,
  },
});