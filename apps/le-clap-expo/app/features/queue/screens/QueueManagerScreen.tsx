import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useCompilationQueue,
  useRetryQueueItem,
  useRemoveQueueItem,
  useCleanupQueue,
  useProcessQueuedCompilations,
} from '@/src/hooks/useCompilationQueue';
import { useOffline } from '@/src/providers/OfflineProvider';
import { NetworkStatusIndicator } from '../../../components/ui/NetworkStatusIndicator';
import { styles } from '@/src/styles/screens/QueueManagerScreenStyles';
import { colors } from '@/src/styles/theme';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterStatus = 'all' | 'pending' | 'processing' | 'failed' | 'completed';
type MutateAsync<T> = (arg: T) => Promise<unknown>;
type StatusIconName = 'time-outline' | 'sync' | 'alert-circle-outline' | 'checkmark-circle' | 'help-circle-outline';

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return colors.warning;
    case 'processing':
      return colors.primary;
    case 'failed':
      return colors.error;
    case 'completed':
      return colors.success;
    default:
      return colors.textSecondary;
  }
}

function getStatusIcon(status: string): StatusIconName {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'processing':
      return 'sync';
    case 'failed':
      return 'alert-circle-outline';
    case 'completed':
      return 'checkmark-circle';
    default:
      return 'help-circle-outline';
  }
}

function runBatchMutations(ids: string[], mutateAsync: MutateAsync<string>): void {
  Promise.allSettled(
    ids.map((id) =>
      mutateAsync(id).catch((error: unknown) => {
        console.error(`Mutation failed for ${id}:`, error);
      })
    )
  )
    .then(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    })
    .catch(() => null);
}

interface QueueItemData {
  id: string;
  projectId: string;
  status: string;
  createdAt: string;
  retryCount: number;
  error?: string;
}

function QueueItemCard({
  item,
  isSelected,
  onPress,
}: {
  item: QueueItemData;
  isSelected: boolean;
  onPress: (id: string) => void;
}) {
  const handlePress = () => {
    onPress(item.id);
  };

  return (
    <TouchableOpacity
      style={[styles.queueItem, isSelected && styles.queueItemSelected]}
      onPress={handlePress}
      onLongPress={handlePress}
    >
      <View style={styles.queueItemHeader}>
        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
          )}
        </View>
        <View style={styles.statusIndicator}>
          <Ionicons name={getStatusIcon(item.status)} size={20} color={getStatusColor(item.status)} />
        </View>
        <View style={styles.queueItemInfo}>
          <Text style={styles.queueItemTitle}>Project: {item.projectId.substring(0, 12)}...</Text>
          <Text style={styles.queueItemStatus}>
            Status: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
          <Text style={styles.queueItemTime}>Created: {new Date(item.createdAt).toLocaleString()}</Text>
          {item.retryCount > 0 && <Text style={styles.retryCount}>Retries: {item.retryCount}</Text>}
          {item.error !== undefined && (
            <Text style={styles.errorText} numberOfLines={2}>
              Error: {item.error}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilterButton({
  status,
  label,
  count,
  activeFilter,
  onPress,
}: {
  status: FilterStatus;
  label: string;
  count: number;
  activeFilter: FilterStatus;
  onPress: (s: FilterStatus) => void;
}) {
  const handlePress = () => {
    onPress(status);
  };

  return (
    <TouchableOpacity
      style={[styles.filterButton, activeFilter === status && styles.filterButtonActive]}
      onPress={handlePress}
    >
      <Text style={[styles.filterButtonText, activeFilter === status && styles.filterButtonTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function useQueueManagerHandlers(params: {
  isOffline: boolean;
  selectedItems: string[];
  filteredItems: QueueItemData[];
  refetch: () => Promise<unknown>;
  retryMutate: MutateAsync<string>;
  removeMutate: MutateAsync<string>;
  cleanupMutate: () => Promise<unknown>;
  processMutate: (maxRetries: number) => Promise<unknown>;
  setRefreshing: (v: boolean) => void;
  setSelectedItems: (fn: (prev: string[]) => string[]) => void;
  setShowBatchActions: (v: boolean) => void;
  setFilterStatus: (s: FilterStatus) => void;
  router: { back: () => void };
}) {
  const {
    isOffline,
    selectedItems,
    filteredItems,
    refetch,
    retryMutate,
    removeMutate,
    cleanupMutate,
    processMutate,
    setRefreshing,
    setSelectedItems,
    setShowBatchActions,
    setFilterStatus,
    router,
  } = params;

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    setRefreshing(true);
    refetch()
      .finally(() => {
        setRefreshing(false);
      })
      .catch(() => null);
  };

  const handleSelectItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    setSelectedItems((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      setShowBatchActions(next.length > 0);

      return next;
    });
  };

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    const allIds = filteredItems.map((item) => item.id);
    setSelectedItems(() => (selectedItems.length === allIds.length ? [] : allIds));
    setShowBatchActions(selectedItems.length !== allIds.length);
  };

  const handleFilterChange = (status: FilterStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    setFilterStatus(status);
    setSelectedItems(() => []);
    setShowBatchActions(false);
  };

  const handleBatchRetry = () => {
    if (isOffline) {
      Alert.alert('🌐 Offline', 'Cannot retry items while offline.');

      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
    const ids = [...selectedItems];
    Alert.alert('🔄 Batch Retry', `Retry ${ids.length} selected items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retry All',
        onPress: () => {
          runBatchMutations(ids, retryMutate);
          setSelectedItems(() => []);
          setShowBatchActions(false);
        },
      },
    ]);
  };

  const handleBatchRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
    const ids = [...selectedItems];
    Alert.alert('🗑️ Batch Remove', `Remove ${ids.length} selected items from queue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove All',
        style: 'destructive',
        onPress: () => {
          runBatchMutations(ids, removeMutate);
          setSelectedItems(() => []);
          setShowBatchActions(false);
        },
      },
    ]);
  };

  const handleProcessAll = () => {
    if (isOffline) {
      Alert.alert('🌐 Offline', 'Cannot process queue while offline.');

      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
    processMutate(3)
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
      })
      .catch((error: unknown) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
        Alert.alert('❌ Process Failed', error instanceof Error ? error.message : 'Unknown error');
      });
  };

  const handleCleanup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    Alert.alert('🧹 Cleanup Queue', 'Remove completed items older than 7 days?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Cleanup',
        onPress: () => {
          cleanupMutate()
            .then(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
            })
            .catch(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
            });
        },
      },
    ]);
  };

  const handleCloseBatchModal = () => {
    setShowBatchActions(false);
    setSelectedItems(() => []);
  };
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    router.back();
  };

  return {
    handleRefresh,
    handleSelectItem,
    handleSelectAll,
    handleFilterChange,
    handleBatchRetry,
    handleBatchRemove,
    handleProcessAll,
    handleCleanup,
    handleCloseBatchModal,
    handleBackPress,
  };
}

export default function QueueManagerScreen() {
  const router = useRouter();
  const { data: queueItems = [], refetch } = useCompilationQueue();
  const { isOffline } = useOffline();
  const retryQueueItem = useRetryQueueItem();
  const removeQueueItem = useRemoveQueueItem();
  const cleanupQueue = useCleanupQueue();
  const processQueue = useProcessQueuedCompilations();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const { filteredItems, pendingCount, processingCount, failedCount, completedCount } = (() => {
    let pending = 0;
    let processing = 0;
    let failed = 0;
    let completed = 0;
    const filtered: typeof queueItems = [];

    for (const item of queueItems) {
      switch (item.status) {
        case 'pending':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'failed':
          failed++;
          break;
        case 'completed':
          completed++;
          break;
        default:
          break;
      }

      if (filterStatus === 'all' || item.status === filterStatus) {
        filtered.push(item);
      }
    }

    return {
      filteredItems: filtered,
      pendingCount: pending,
      processingCount: processing,
      failedCount: failed,
      completedCount: completed,
    };
  })();

  const handlers = useQueueManagerHandlers({
    isOffline,
    selectedItems,
    filteredItems,
    refetch,
    retryMutate: (id: string) => retryQueueItem.mutateAsync(id),
    removeMutate: (id: string) => removeQueueItem.mutateAsync(id),
    cleanupMutate: () => cleanupQueue.mutateAsync(),
    processMutate: (maxRetries: number) => processQueue.mutateAsync(maxRetries),
    setRefreshing,
    setSelectedItems,
    setShowBatchActions,
    setFilterStatus,
    router,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handlers.handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue Manager</Text>
        <TouchableOpacity style={styles.selectAllButton} onPress={handlers.handleSelectAll}>
          <Text style={styles.selectAllText}>
            {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <NetworkStatusIndicator compact />
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{queueItems.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{processingCount}</Text>
          <Text style={styles.statLabel}>Processing</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.error }]}>{failedCount}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, isOffline && styles.actionButtonDisabled]}
          onPress={handlers.handleProcessAll}
          disabled={isOffline || processQueue.isPending}
        >
          <Ionicons name="play" size={16} color={isOffline ? colors.textSecondary : colors.primary} />
          <Text style={[styles.actionButtonText, isOffline && { color: colors.textSecondary }]}>
            {processQueue.isPending ? 'Processing...' : 'Process All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handlers.handleCleanup}
          disabled={cleanupQueue.isPending}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.actionButtonText}>{cleanupQueue.isPending ? 'Cleaning...' : 'Cleanup'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <FilterButton
          status="all"
          label="All"
          count={queueItems.length}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="pending"
          label="Pending"
          count={pendingCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="processing"
          label="Processing"
          count={processingCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="failed"
          label="Failed"
          count={failedCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="completed"
          label="Completed"
          count={completedCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
      </ScrollView>
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlers.handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {filterStatus === 'all' ? 'No items in queue' : `No ${filterStatus} items`}
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              isSelected={selectedItems.includes(item.id)}
              onPress={handlers.handleSelectItem}
            />
          ))
        )}
      </ScrollView>
      <Modal
        visible={showBatchActions}
        transparent
        animationType="slide"
        onRequestClose={handlers.handleCloseBatchModal}
      >
        <View style={styles.batchModalOverlay}>
          <View style={styles.batchModalContent}>
            <Text style={styles.batchModalTitle}>
              {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected
            </Text>
            <View style={styles.batchActions}>
              <TouchableOpacity
                style={[styles.batchButton, styles.batchRetryButton]}
                onPress={handlers.handleBatchRetry}
                disabled={isOffline}
              >
                <Ionicons name="refresh" size={20} color={colors.primary} />
                <Text style={styles.batchButtonText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchButton, styles.batchRemoveButton]}
                onPress={handlers.handleBatchRemove}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.batchButtonText, { color: colors.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.batchCancelButton} onPress={handlers.handleCloseBatchModal}>
              <Text style={styles.batchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
