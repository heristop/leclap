import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/src/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: spacing.s,
  },
  headerTitle: {
    ...typography.title,
    flex: 1,
    textAlign: 'center',
  },
  selectAllButton: {
    padding: spacing.s,
  },
  selectAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.title,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.s,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.xs,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    ...typography.caption,
    fontWeight: '500',
  },
  filterContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  filterContent: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    gap: spacing.s,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.text,
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterBadge: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.m,
  },
  queueItem: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.m,
    marginVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  queueItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  queueItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.m,
  },
  selectionIndicator: {
    marginRight: spacing.m,
    marginTop: 2,
  },
  statusIndicator: {
    marginRight: spacing.m,
    marginTop: 2,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  queueItemStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  queueItemTime: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  retryCount: {
    ...typography.caption,
    fontSize: 11,
    color: colors.warning,
    marginBottom: 2,
  },
  errorText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.error,
    fontStyle: 'italic',
  },
  batchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  batchModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.l,
    paddingBottom: spacing.xl,
  },
  batchModalTitle: {
    ...typography.subtitle,
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  batchActions: {
    flexDirection: 'row',
    gap: spacing.m,
    marginBottom: spacing.l,
  },
  batchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: 12,
    gap: spacing.s,
  },
  batchRetryButton: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  batchRemoveButton: {
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error + '20',
  },
  batchButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  batchCancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.m,
  },
  batchCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
