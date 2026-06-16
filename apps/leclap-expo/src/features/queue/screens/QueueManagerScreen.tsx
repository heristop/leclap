import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

// Friendly, human-readable status label (the raw status reads like a database field).
function getStatusLabel(status: string, t: TFunction<'queue'>): string {
  switch (status) {
    case 'pending':
      return t('status.waiting');
    case 'processing':
      return t('status.rendering');
    case 'failed':
      return t('status.failed');
    case 'completed':
      return t('status.ready');
    default:
      return status;
  }
}

// "just now" / "5 min ago" / "3 h ago" / "Apr 12" — friendlier than a full timestamp.
function relativeTime(iso: string, t: TFunction<'queue'>): string {
  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) {
    return '';
  }

  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));

  if (mins < 1) {
    return t('relativeTime.justNow');
  }

  if (mins < 60) {
    return t('relativeTime.minAgo', { count: mins });
  }

  const hours = Math.round(mins / 60);

  if (hours < 24) {
    return t('relativeTime.hourAgo', { count: hours });
  }

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  t,
}: {
  item: QueueItemData;
  isSelected: boolean;
  onPress: (id: string) => void;
  t: TFunction<'queue'>;
}) {
  const handlePress = () => {
    onPress(item.id);
  };

  const accent = getStatusColor(item.status);
  const isProcessing = item.status === 'processing';

  return (
    <TouchableOpacity
      style={[styles.queueItem, isSelected && styles.queueItemSelected]}
      onPress={handlePress}
      onLongPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('screen.videoAccessibility', {
        status: getStatusLabel(item.status, t),
        time: relativeTime(item.createdAt, t),
      })}
    >
      {/* Status-coloured left accent — reads the card's state before any text. */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.thumb}>
        <Ionicons name="film-outline" size={22} color={colors.primary} />
      </View>

      <View style={styles.queueItemInfo}>
        <View style={styles.queueItemTopRow}>
          <Text style={styles.queueItemTitle} numberOfLines={1}>
            {t('screen.yourVideo')}
          </Text>
          <Text style={styles.queueItemTime}>{relativeTime(item.createdAt, t)}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: `${accent}1A` }]}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Ionicons name={getStatusIcon(item.status)} size={13} color={accent} />
            )}
            <Text style={[styles.statusPillText, { color: accent }]}>{getStatusLabel(item.status, t)}</Text>
          </View>
          {item.retryCount > 0 && (
            <Text style={styles.retryCount}>{t('screen.retried', { count: item.retryCount })}</Text>
          )}
        </View>

        {item.error !== undefined && (
          <Text style={styles.errorText} numberOfLines={2}>
            {item.error}
          </Text>
        )}
      </View>

      <View style={styles.selectionIndicator}>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? colors.primary : colors.divider}
        />
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
  router: { back: () => void; canGoBack: () => boolean; replace: (href: '/') => void };
  t: TFunction<'queue'>;
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
    t,
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
      Alert.alert(t('offline.title'), t('offline.retryMessage'));

      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
    const ids = [...selectedItems];
    Alert.alert(t('alerts.retry.title'), t('alerts.retry.message', { count: ids.length }), [
      { text: t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: t('alerts.retry.confirm'),
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
    Alert.alert(t('alerts.remove.title'), t('alerts.remove.message', { count: ids.length }), [
      { text: t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: t('alerts.remove.confirm'),
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
      Alert.alert(t('offline.title'), t('offline.compileMessage'));

      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => null);
    processMutate(3)
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
      })
      .catch((error: unknown) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
        Alert.alert(t('couldntCompile.title'), error instanceof Error ? error.message : t('couldntCompile.fallback'));
      });
  };

  const handleCleanup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    Alert.alert(t('alerts.cleanup.title'), t('alerts.cleanup.message'), [
      { text: t('actions.cancel', { ns: 'common' }), style: 'cancel' },
      {
        text: t('alerts.cleanup.confirm'),
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
    // Deep-linked entry has no back stack → router.back() would throw "GO_BACK not handled".
    if (router.canGoBack()) {
      router.back();

      return;
    }
    router.replace('/');
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

interface QueueSummary<T> {
  filteredItems: T[];
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  completedCount: number;
}

// Tally queue items by status and apply the active filter in a single pass — kept out of the component
// so its cyclomatic complexity stays manageable.
function summarizeQueue<T extends { status: string }>(
  items: readonly T[],
  filterStatus: FilterStatus
): QueueSummary<T> {
  let pending = 0;
  let processing = 0;
  let failed = 0;
  let completed = 0;
  const filtered: T[] = [];

  for (const item of items) {
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
}

// Empty-state body for the queue list — varies by whether a status filter is active. Kept as its own
// component so the screen's render stays under the complexity cap.
function QueueEmptyState({
  filterStatus,
  onCreate,
  onShowAll,
  t,
}: {
  filterStatus: FilterStatus;
  onCreate: () => void;
  onShowAll: () => void;
  t: TFunction<'queue'>;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name={filterStatus === 'all' ? 'film-outline' : 'funnel-outline'} size={32} color={colors.primary} />
      </View>
      {filterStatus === 'all' ? (
        <>
          <Text style={styles.emptyTitle}>{t('empty.title')}</Text>
          <Text style={styles.emptyText}>{t('empty.text')}</Text>
          <TouchableOpacity style={styles.emptyCta} onPress={onCreate}>
            <Ionicons name="add" size={18} color={colors.surface} />
            <Text style={styles.emptyCtaText}>{t('empty.cta')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>
            {t('empty.filteredTitle', { status: getStatusLabel(filterStatus, t).toLowerCase() })}
          </Text>
          <Text style={styles.emptyText}>{t('empty.filteredText')}</Text>
          <TouchableOpacity style={styles.emptyCtaGhost} onPress={onShowAll}>
            <Text style={styles.emptyCtaGhostText}>{t('empty.showAll')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// Processing summary banner — only shown while something is rendering. Extracted to keep the screen
// render under the complexity cap.
function ProcessingBanner({
  processingCount,
  pendingCount,
  t,
}: {
  processingCount: number;
  pendingCount: number;
  t: TFunction<'queue'>;
}) {
  if (processingCount === 0) {
    return null;
  }

  return (
    <View style={styles.summaryBanner}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.summaryText}>
        {t('processingBanner.rendering', { count: processingCount })}
        {pendingCount > 0 && t('processingBanner.waiting', { count: pendingCount })}
      </Text>
    </View>
  );
}

// Top action bar (Process All / Cleanup). Extracted so its branching stays out of the screen render.
function QueueActionBar({
  isOffline,
  processPending,
  cleanupPending,
  onProcessAll,
  onCleanup,
  t,
}: {
  isOffline: boolean;
  processPending: boolean;
  cleanupPending: boolean;
  onProcessAll: () => void;
  onCleanup: () => void;
  t: TFunction<'queue'>;
}) {
  return (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={[styles.actionButton, isOffline && styles.actionButtonDisabled]}
        onPress={onProcessAll}
        disabled={isOffline || processPending}
      >
        <Ionicons name="play" size={16} color={isOffline ? colors.textSecondary : colors.primary} />
        <Text style={[styles.actionButtonText, isOffline && { color: colors.textSecondary }]}>
          {processPending ? t('actionBar.processing') : t('actionBar.processAll')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onCleanup} disabled={cleanupPending}>
        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.actionButtonText}>{cleanupPending ? t('actionBar.cleaning') : t('actionBar.cleanup')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function QueueManagerScreen() {
  const { t } = useTranslation('queue');
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

  const { filteredItems, pendingCount, processingCount, failedCount, completedCount } = summarizeQueue(
    queueItems,
    filterStatus
  );

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
    t,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handlers.handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screen.title')}</Text>
        <TouchableOpacity style={styles.selectAllButton} onPress={handlers.handleSelectAll}>
          <Text style={styles.selectAllText}>
            {selectedItems.length === filteredItems.length ? t('screen.deselectAll') : t('screen.selectAll')}
          </Text>
        </TouchableOpacity>
      </View>
      <NetworkStatusIndicator compact />
      <ProcessingBanner processingCount={processingCount} pendingCount={pendingCount} t={t} />
      <QueueActionBar
        isOffline={isOffline}
        processPending={processQueue.isPending}
        cleanupPending={cleanupQueue.isPending}
        onProcessAll={handlers.handleProcessAll}
        onCleanup={handlers.handleCleanup}
        t={t}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <FilterButton
          status="all"
          label={t('filters.all')}
          count={queueItems.length}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="pending"
          label={t('filters.pending')}
          count={pendingCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="processing"
          label={t('filters.processing')}
          count={processingCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="failed"
          label={t('filters.failed')}
          count={failedCount}
          activeFilter={filterStatus}
          onPress={handlers.handleFilterChange}
        />
        <FilterButton
          status="completed"
          label={t('filters.completed')}
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
          <QueueEmptyState
            filterStatus={filterStatus}
            onCreate={handlers.handleBackPress}
            onShowAll={() => {
              handlers.handleFilterChange('all');
            }}
            t={t}
          />
        ) : (
          filteredItems.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              isSelected={selectedItems.includes(item.id)}
              onPress={handlers.handleSelectItem}
              t={t}
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
            <Text style={styles.batchModalTitle}>{t('batchModal.selected', { count: selectedItems.length })}</Text>
            <View style={styles.batchActions}>
              <TouchableOpacity
                style={[styles.batchButton, styles.batchRetryButton]}
                onPress={handlers.handleBatchRetry}
                disabled={isOffline}
              >
                <Ionicons name="refresh" size={20} color={colors.primary} />
                <Text style={styles.batchButtonText}>{t('batchModal.retry')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchButton, styles.batchRemoveButton]}
                onPress={handlers.handleBatchRemove}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.batchButtonText, { color: colors.error }]}>{t('batchModal.remove')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.batchCancelButton} onPress={handlers.handleCloseBatchModal}>
              <Text style={styles.batchCancelText}>{t('actions.cancel', { ns: 'common' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
