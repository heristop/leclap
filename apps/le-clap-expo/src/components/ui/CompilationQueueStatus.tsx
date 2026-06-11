import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePendingCompilations, useRetryQueueItem, useRemoveQueueItem } from '@/src/hooks/useCompilationQueue';
import { useOffline } from '@/src/providers/OfflineProvider';
import { colors, spacing, typography } from '@/src/styles/theme';
import * as Haptics from 'expo-haptics';

function getStatusColor(status: string): string {
  if (status === 'pending') return colors.warning;

  if (status === 'processing') return colors.primary;

  if (status === 'failed') return colors.error;

  return colors.textSecondary;
}

function getStatusIcon(status: string): 'time-outline' | 'sync' | 'alert-circle-outline' | 'help-circle-outline' {
  if (status === 'pending') return 'time-outline';

  if (status === 'processing') return 'sync';

  if (status === 'failed') return 'alert-circle-outline';

  return 'help-circle-outline';
}

function getStatusLabel(status: string, retryCount: number): string {
  if (status === 'failed') return `❌ Failed (${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})`;

  if (status === 'processing') return '⚙️ Processing...';

  return '⏳ Pending';
}

function fireAndForget(promise: Promise<unknown>): void {
  promise.catch((_err) => {});
}

type QueueItem = {
  id: string;
  projectId: string;
  status: string;
  retryCount: number;
  createdAt: string | number | Date;
};
type RetryMutation = ReturnType<typeof useRetryQueueItem>;
type RemoveMutation = ReturnType<typeof useRemoveQueueItem>;

const OK_BUTTON = [{ text: 'OK', style: 'default' as const }];

function handleRetry(itemId: string, isOffline: boolean, retryQueueItem: RetryMutation): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

  if (isOffline) {
    Alert.alert('🌐 No Internet Connection', 'Please connect to the internet to retry video compilation.', OK_BUTTON);

    return;
  }

  retryQueueItem.mutate(itemId, {
    onSuccess: (result) => {
      if (!result.success) {
        Alert.alert('❌ Retry Failed', result.error ?? 'Compilation failed again.', OK_BUTTON);

        return;
      }

      Alert.alert('✅ Success!', 'Video compilation completed successfully!', [{ text: 'Great!', style: 'default' }]);
    },
    onError: (error) => {
      Alert.alert('⚠️ Retry Error', error.message, OK_BUTTON);
    },
  });
}

function handleRemove(itemId: string, removeQueueItem: RemoveMutation): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

  Alert.alert('🗑️ Remove from Queue', 'Are you sure you want to remove this compilation from the queue?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove',
      style: 'destructive',
      onPress: () => {
        fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        removeQueueItem.mutate(itemId);
      },
    },
  ]);
}

type QueueItemViewProps = {
  item: QueueItem;
  expandAnim: Animated.Value;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  isRetryPending: boolean;
  isRemovePending: boolean;
};

function QueueItemView({ item, expandAnim, onRetry, onRemove, isRetryPending, isRemovePending }: QueueItemViewProps) {
  const statusColor = getStatusColor(item.status);
  const animStyle = {
    transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    opacity: expandAnim,
  };

  return (
    <Animated.View style={[styles.queueItem, animStyle]}>
      <View style={styles.queueItemHeader}>
        <View style={styles.statusIndicator}>
          <Ionicons name={getStatusIcon(item.status)} size={18} color={statusColor} />
          {item.status === 'processing' && (
            <View style={styles.pulseContainer}>
              <Animated.View style={[styles.pulseRing, { backgroundColor: `${statusColor}30` }]} />
            </View>
          )}
        </View>
        <View style={styles.queueItemInfo}>
          <Text style={styles.queueItemTitle} numberOfLines={1}>
            Project: {item.projectId.substring(0, 8)}...
          </Text>
          <Text style={styles.queueItemStatus}>{getStatusLabel(item.status, item.retryCount)}</Text>
          <Text style={styles.queueItemTime}>
            Added {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
      <View style={styles.queueItemActions}>
        {item.status === 'failed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => {
              onRetry(item.id);
            }}
            disabled={isRetryPending}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.actionButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => {
            onRemove(item.id);
          }}
          disabled={isRemovePending}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

type QueueHeaderProps = { pendingCount: number; isOffline: boolean; isExpanded: boolean; onToggle: () => void };

function QueueHeader({ pendingCount, isOffline, isExpanded, onToggle }: QueueHeaderProps) {
  const label =
    pendingCount === 0 ? 'No videos in queue' : `${pendingCount} video${pendingCount === 1 ? '' : 's'} queued`;

  return (
    <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.headerIcon}>
        <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.headerTextContainer}>
        <Text style={styles.headerText}>{label}</Text>
        <Text style={styles.headerSubtext}>
          {isOffline ? '📴 Will process when online' : '🌐 Processing when possible'}
        </Text>
      </View>
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      )}
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.textSecondary}
        style={styles.expandIcon}
      />
    </TouchableOpacity>
  );
}

function QueueFooter({ isOffline }: { isOffline: boolean }) {
  return (
    <View style={styles.queueSummary}>
      {isOffline ? (
        <Text style={styles.offlineMessage}>📱 Offline: Videos will process automatically when connected</Text>
      ) : (
        <Text style={styles.onlineMessage}>🌐 Online: Processing queue in background</Text>
      )}
    </View>
  );
}

function CompilationQueueStatus() {
  const { data: pendingCompilations = [] } = usePendingCompilations();
  const { isOffline } = useOffline();
  const retryQueueItem = useRetryQueueItem();
  const removeQueueItem = useRemoveQueueItem();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandAnim] = useState(new Animated.Value(0));

  if (pendingCompilations.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.spring(expandAnim, { toValue, useNativeDriver: false, tension: 100, friction: 8 }).start();
  };

  const maxVisibleItems = isExpanded ? pendingCompilations.length : 3;
  const visibleItems = pendingCompilations.slice(0, maxVisibleItems);
  const hiddenCount = Math.max(0, pendingCompilations.length - maxVisibleItems);
  const animContainerStyle = [
    styles.itemsContainer,
    { maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }), opacity: expandAnim },
  ];

  return (
    <View style={styles.container}>
      <QueueHeader
        pendingCount={pendingCompilations.length}
        isOffline={isOffline}
        isExpanded={isExpanded}
        onToggle={toggleExpanded}
      />
      <Animated.View style={animContainerStyle}>
        {visibleItems.map((item) => (
          <QueueItemView
            key={item.id}
            item={item}
            expandAnim={expandAnim}
            onRetry={(id) => {
              handleRetry(id, isOffline, retryQueueItem);
            }}
            onRemove={(id) => {
              handleRemove(id, removeQueueItem);
            }}
            isRetryPending={retryQueueItem.isPending}
            isRemovePending={removeQueueItem.isPending}
          />
        ))}
      </Animated.View>
      {!isExpanded && hiddenCount > 0 && (
        <TouchableOpacity style={styles.showMoreButton} onPress={toggleExpanded}>
          <Text style={styles.showMoreText}>
            👆 Tap to show {hiddenCount} more item{hiddenCount === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
      )}
      {pendingCompilations.length > 0 && <QueueFooter isOffline={isOffline} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.m, backgroundColor: `${colors.background}50` },
  headerIcon: { position: 'relative', marginRight: spacing.m },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  headerTextContainer: { flex: 1 },
  headerText: { ...typography.subtitle, marginBottom: 2 },
  headerSubtext: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
  offlineBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
    marginRight: spacing.s,
  },
  offlineBadgeText: { color: 'white', fontSize: 10, fontWeight: '600' },
  expandIcon: { marginLeft: spacing.xs },
  itemsContainer: { overflow: 'hidden' },
  queueItem: {
    backgroundColor: `${colors.background}30`,
    marginHorizontal: spacing.s,
    marginVertical: spacing.xs,
    borderRadius: 12,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  queueItemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.s },
  statusIndicator: { position: 'relative', marginRight: spacing.m, marginTop: 2 },
  pulseContainer: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  pulseRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, opacity: 0.6 },
  queueItemInfo: { flex: 1 },
  queueItemTitle: { ...typography.body, fontWeight: '600', marginBottom: 2 },
  queueItemStatus: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  queueItemTime: { ...typography.caption, fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' },
  queueItemActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 8,
    gap: spacing.xs,
  },
  retryButton: { backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: `${colors.primary}30` },
  removeButton: { backgroundColor: `${colors.error}10`, borderWidth: 1, borderColor: `${colors.error}20` },
  actionButtonText: { ...typography.caption, fontWeight: '500', fontSize: 12 },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: `${colors.background}20`,
  },
  showMoreText: { ...typography.caption, color: colors.primary, fontWeight: '500' },
  queueSummary: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: `${colors.background}30`,
  },
  offlineMessage: { ...typography.caption, color: colors.warning, textAlign: 'center', fontStyle: 'italic' },
  onlineMessage: { ...typography.caption, color: colors.success, textAlign: 'center', fontStyle: 'italic' },
});

export default CompilationQueueStatus;
export { CompilationQueueStatus };
