import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useCompilationQueue,
  useRetryQueueItem,
  useRemoveQueueItem,
  useCleanupQueue,
  useProcessQueuedCompilations,
} from '../../../hooks/useCompilationQueue';
import { useOffline } from '../../../providers/OfflineProvider';
import { NetworkStatusIndicator } from '../../../components/ui/NetworkStatusIndicator';
import { styles } from './QueueManagerScreenStyles';
import { colors } from '../../../styles/theme';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'processing' | 'failed' | 'completed'>('all');

  const filteredItems = queueItems.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const pendingCount = queueItems.filter(item => item.status === 'pending').length;
  const processingCount = queueItems.filter(item => item.status === 'processing').length;
  const failedCount = queueItems.filter(item => item.status === 'failed').length;
  const completedCount = queueItems.filter(item => item.status === 'completed').length;

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectItem = async (itemId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItems(prev => {
      const newSelection = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];

      setShowBatchActions(newSelection.length > 0);
      return newSelection;
    });
  };

  const handleSelectAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const allIds = filteredItems.map(item => item.id);
    setSelectedItems(selectedItems.length === allIds.length ? [] : allIds);
    setShowBatchActions(selectedItems.length !== allIds.length);
  };

  const handleBatchRetry = async () => {
    if (isOffline) {
      Alert.alert('🌐 Offline', 'Cannot retry items while offline.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      '🔄 Batch Retry',
      `Retry ${selectedItems.length} selected items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry All',
          onPress: async () => {
            for (const itemId of selectedItems) {
              try {
                await retryQueueItem.mutateAsync(itemId);
              } catch (error) {
                console.error(`Failed to retry item ${itemId}:`, error);
              }
            }
            setSelectedItems([]);
            setShowBatchActions(false);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleBatchRemove = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      '🗑️ Batch Remove',
      `Remove ${selectedItems.length} selected items from queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            for (const itemId of selectedItems) {
              try {
                await removeQueueItem.mutateAsync(itemId);
              } catch (error) {
                console.error(`Failed to remove item ${itemId}:`, error);
              }
            }
            setSelectedItems([]);
            setShowBatchActions(false);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleProcessAll = async () => {
    if (isOffline) {
      Alert.alert('🌐 Offline', 'Cannot process queue while offline.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await processQueue.mutateAsync(3);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('❌ Process Failed', (error as Error).message);
    }
  };

  const handleCleanup = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      '🧹 Cleanup Queue',
      'Remove completed items older than 7 days?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: async () => {
            try {
              await cleanupQueue.mutateAsync();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'processing': return colors.primary;
      case 'failed': return colors.error;
      case 'completed': return colors.success;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline' as const;
      case 'processing': return 'sync' as const;
      case 'failed': return 'alert-circle-outline' as const;
      case 'completed': return 'checkmark-circle' as const;
      default: return 'help-circle-outline' as const;
    }
  };

  const renderFilterButton = (status: typeof filterStatus, label: string, count: number) => (
    <TouchableOpacity
      key={status}
      style={[
        styles.filterButton,
        filterStatus === status && styles.filterButtonActive
      ]}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFilterStatus(status);
        setSelectedItems([]);
        setShowBatchActions(false);
      }}
    >
      <Text style={[
        styles.filterButtonText,
        filterStatus === status && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue Manager</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={handleSelectAll}
        >
          <Text style={styles.selectAllText}>
            {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>

      <NetworkStatusIndicator compact />

      {/* Stats Summary */}
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

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, isOffline && styles.actionButtonDisabled]}
          onPress={handleProcessAll}
          disabled={isOffline || processQueue.isPending}
        >
          <Ionicons name="play" size={16} color={isOffline ? colors.textSecondary : colors.primary} />
          <Text style={[styles.actionButtonText, isOffline && { color: colors.textSecondary }]}>
            {processQueue.isPending ? 'Processing...' : 'Process All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCleanup}
          disabled={cleanupQueue.isPending}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.actionButtonText}>
            {cleanupQueue.isPending ? 'Cleaning...' : 'Cleanup'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {renderFilterButton('all', 'All', queueItems.length)}
        {renderFilterButton('pending', 'Pending', pendingCount)}
        {renderFilterButton('processing', 'Processing', processingCount)}
        {renderFilterButton('failed', 'Failed', failedCount)}
        {renderFilterButton('completed', 'Completed', completedCount)}
      </ScrollView>

      {/* Queue Items List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
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
            <TouchableOpacity
              key={item.id}
              style={[
                styles.queueItem,
                selectedItems.includes(item.id) && styles.queueItemSelected
              ]}
              onPress={() => handleSelectItem(item.id)}
              onLongPress={() => handleSelectItem(item.id)}
            >
              <View style={styles.queueItemHeader}>
                <View style={styles.selectionIndicator}>
                  {selectedItems.includes(item.id) ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color={colors.divider} />
                  )}
                </View>

                <View style={styles.statusIndicator}>
                  <Ionicons
                    name={getStatusIcon(item.status)}
                    size={20}
                    color={getStatusColor(item.status)}
                  />
                </View>

                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemTitle}>
                    Project: {item.projectId.substring(0, 12)}...
                  </Text>
                  <Text style={styles.queueItemStatus}>
                    Status: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                  <Text style={styles.queueItemTime}>
                    Created: {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  {item.retryCount > 0 && (
                    <Text style={styles.retryCount}>
                      Retries: {item.retryCount}
                    </Text>
                  )}
                  {item.error && (
                    <Text style={styles.errorText} numberOfLines={2}>
                      Error: {item.error}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Batch Actions Modal */}
      <Modal
        visible={showBatchActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBatchActions(false)}
      >
        <View style={styles.batchModalOverlay}>
          <View style={styles.batchModalContent}>
            <Text style={styles.batchModalTitle}>
              {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected
            </Text>

            <View style={styles.batchActions}>
              <TouchableOpacity
                style={[styles.batchButton, styles.batchRetryButton]}
                onPress={handleBatchRetry}
                disabled={isOffline}
              >
                <Ionicons name="refresh" size={20} color={colors.primary} />
                <Text style={styles.batchButtonText}>Retry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.batchButton, styles.batchRemoveButton]}
                onPress={handleBatchRemove}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.batchButtonText, { color: colors.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.batchCancelButton}
              onPress={() => {
                setShowBatchActions(false);
                setSelectedItems([]);
              }}
            >
              <Text style={styles.batchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}