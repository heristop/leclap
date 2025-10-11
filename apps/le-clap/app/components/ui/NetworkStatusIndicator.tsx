import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOffline } from '../../providers/OfflineProvider';
import { useTemplatesSyncStatus } from '../../hooks/useTemplates';
import { colors, spacing, typography } from '../../styles/theme';

interface NetworkStatusIndicatorProps {
  showWhenOnline?: boolean;
  compact?: boolean;
  expandable?: boolean;
  showSyncStatus?: boolean;
}

export function NetworkStatusIndicator({
  showWhenOnline = false,
  compact = false,
  expandable = true,
  showSyncStatus = true
}: NetworkStatusIndicatorProps) {
  const { isOnline, isOffline, networkType, hasInternet } = useOffline();
  const { data: syncStatus } = useTemplatesSyncStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);

  // Track status changes for auto-expand
  useEffect(() => {
    setLastStatusChange(new Date());
    if (!isOnline) {
      // Auto-expand when going offline
      setIsExpanded(true);
    }
  }, [isOnline]);

  // Auto-collapse after 5 seconds when online
  useEffect(() => {
    if (isOnline && isExpanded && !showWhenOnline) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isExpanded, showWhenOnline]);

  // Animation for expand/collapse
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, slideAnim]);

  // Don't show when online unless explicitly requested
  if (isOnline && !showWhenOnline) {
    return null;
  }

  const getConnectionQuality = () => {
    if (!isOnline) return 'none';
    if (networkType === 'wifi') return 'excellent';
    if (networkType === 'cellular') return hasInternet ? 'good' : 'poor';
    return 'unknown';
  };

  const getStatusColor = () => {
    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent': return colors.success;
      case 'good': return '#8BC34A'; // Light green
      case 'poor': return colors.warning;
      case 'none': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = () => {
    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent': return 'wifi' as const;
      case 'good': return 'cellular' as const;
      case 'poor': return 'cellular-outline' as const;
      case 'none': return 'wifi-off' as const;
      default: return 'help-circle-outline' as const;
    }
  };

  const getStatusText = () => {
    if (compact) {
      return isOnline ? 'Online' : 'Offline';
    }

    if (!isOnline) {
      return 'No internet connection';
    }

    const quality = getConnectionQuality();
    switch (quality) {
      case 'excellent': return `Connected via WiFi`;
      case 'good': return `Connected via ${networkType}`;
      case 'poor': return `Weak ${networkType} connection`;
      default: return `Connected (${networkType || 'Unknown'})`;
    }
  };

  const getSyncStatusText = () => {
    if (!syncStatus || !showSyncStatus) return null;

    if (!syncStatus.hasCache) {
      return 'No offline content';
    }

    if (syncStatus.isCacheStale && syncStatus.isOnline) {
      return 'Syncing latest content...';
    }

    if (syncStatus.isCacheStale && !syncStatus.isOnline) {
      return 'Content may be outdated';
    }

    return 'Content up to date';
  };

  const handlePress = () => {
    if (expandable) {
      setIsExpanded(!isExpanded);
    }
  };

  const containerHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [compact ? 32 : 40, compact ? 80 : 120],
  });

  const syncStatusText = getSyncStatusText();
  const shouldShow = isOffline || showWhenOnline || isExpanded;

  if (!shouldShow && !lastStatusChange) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!expandable}
      activeOpacity={expandable ? 0.7 : 1}
    >
      <Animated.View style={[
        styles.container,
        compact && styles.containerCompact,
        { height: expandable ? containerHeight : 'auto' },
        isOffline && styles.containerOffline
      ]}>
        <View style={styles.mainRow}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={getStatusIcon()}
              size={compact ? 16 : 20}
              color={getStatusColor()}
            />
            {/* Connection quality indicators */}
            {isOnline && (
              <View style={styles.qualityBars}>
                {[1, 2, 3].map((bar) => (
                  <View
                    key={bar}
                    style={[
                      styles.qualityBar,
                      {
                        height: bar * 3 + 3,
                        backgroundColor: getConnectionQuality() === 'excellent' ||
                                       (getConnectionQuality() === 'good' && bar <= 2) ||
                                       (getConnectionQuality() === 'poor' && bar <= 1)
                          ? getStatusColor()
                          : colors.divider
                      }
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.textContainer}>
            <Text style={[
              styles.text,
              { color: getStatusColor() },
              compact && styles.textCompact
            ]}>
              {getStatusText()}
            </Text>

            {lastStatusChange && (
              <Text style={styles.timestamp}>
                {lastStatusChange.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            )}
          </View>

          {expandable && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
              style={styles.expandIcon}
            />
          )}
        </View>

        {/* Expanded content */}
        {expandable && (
          <Animated.View style={[
            styles.expandedContent,
            {
              opacity: slideAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                })
              }]
            }
          ]}>
            {syncStatusText && (
              <Text style={styles.syncStatusText}>
                📋 {syncStatusText}
              </Text>
            )}

            {isOffline && (
              <Text style={styles.offlineHelpText}>
                💡 You can still browse cached templates and create projects
              </Text>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  containerCompact: {
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.s,
    marginVertical: spacing.xs,
    borderRadius: 8,
  },
  containerOffline: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08', // Very light error background
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.s,
  },
  qualityBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: spacing.xs,
    height: 12,
  },
  qualityBar: {
    width: 2,
    marginLeft: 1,
    borderRadius: 1,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: 2,
  },
  textCompact: {
    fontSize: 12,
    marginBottom: 0,
  },
  timestamp: {
    ...typography.smallText,
    color: colors.textSecondary,
    fontSize: 10,
  },
  expandIcon: {
    marginLeft: spacing.s,
  },
  expandedContent: {
    marginTop: spacing.s,
    paddingTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  syncStatusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  offlineHelpText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 12,
    fontStyle: 'italic',
  },
});