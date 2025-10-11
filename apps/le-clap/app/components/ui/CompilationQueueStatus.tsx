import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePendingCompilations, useRetryQueueItem, useRemoveQueueItem } from '../../hooks/useCompilationQueue';
import { useOffline } from '../../providers/OfflineProvider';
import { colors, spacing, typography } from '../../styles/theme';

export function CompilationQueueStatus() {
  const { data: pendingCompilations = [] } = usePendingCompilations();
  const { isOffline } = useOffline();
  const retryQueueItem = useRetryQueueItem();
  const removeQueueItem = useRemoveQueueItem();

  if (pendingCompilations.length === 0) {
    return null;
  }

  const handleRetry = (itemId: string) => {
    if (isOffline) {
      Alert.alert(
        'No Internet Connection',
        'Please connect to the internet to retry video compilation.'
      );
      return;
    }

    retryQueueItem.mutate(itemId, {
      onSuccess: (result) => {
        if (result.success) {
          Alert.alert('Success', 'Video compilation completed successfully!');
        } else {
          Alert.alert('Retry Failed', result.error || 'Compilation failed again.');
        }
      },
      onError: (error) => {
        Alert.alert('Retry Error', (error as Error).message);
      },
    });
  };

  const handleRemove = (itemId: string) => {
    Alert.alert(
      'Remove from Queue',
      'Are you sure you want to remove this compilation from the queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeQueueItem.mutate(itemId);
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'processing':
        return colors.primary;
      case 'failed':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline' as const;
      case 'processing':
        return 'sync' as const;
      case 'failed':
        return 'alert-circle-outline' as const;
      default:
        return 'help-circle-outline' as const;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
        <Text style={styles.headerText}>
          {pendingCompilations.length} video{pendingCompilations.length === 1 ? '' : 's'} queued
        </Text>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>Offline</Text>
          </View>
        )}
      </View>

      {pendingCompilations.slice(0, 3).map((item) => (
        <View key={item.id} style={styles.queueItem}>
          <View style={styles.queueItemContent}>
            <Ionicons
              name={getStatusIcon(item.status)}
              size={16}
              color={getStatusColor(item.status)}
              style={styles.statusIcon}
            />
            <View style={styles.queueItemText}>
              <Text style={styles.queueItemTitle} numberOfLines={1}>
                Project {item.projectId}
              </Text>
              <Text style={styles.queueItemStatus}>
                {item.status === 'failed' ? `Failed (${item.retryCount} retries)` : item.status}
              </Text>
            </View>
          </View>

          <View style={styles.queueItemActions}>
            {item.status === 'failed' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRetry(item.id)}
                disabled={retryQueueItem.isPending}
              >
                <Ionicons name="refresh" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleRemove(item.id)}
              disabled={removeQueueItem.isPending}
            >
              <Ionicons name="close" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {pendingCompilations.length > 3 && (
        <Text style={styles.moreText}>
          +{pendingCompilations.length - 3} more in queue
        </Text>
      )}

      {isOffline && (
        <Text style={styles.offlineMessage}>
          Videos will be processed automatically when internet connection is restored
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
    borderRadius: 12,
    padding: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  headerText: {
    ...typography.subtitle,
    marginLeft: spacing.s,
    flex: 1,
  },
  offlineBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs / 2,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  queueItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: spacing.s,
  },
  queueItemText: {
    flex: 1,
  },
  queueItemTitle: {
    ...typography.body,
    fontWeight: '500',
  },
  queueItemStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  queueItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.s,
    marginLeft: spacing.xs,
  },
  moreText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.s,
    fontStyle: 'italic',
  },
  offlineMessage: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
    marginTop: spacing.s,
    fontStyle: 'italic',
  },
});