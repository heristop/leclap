import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCompilationQueue,
  updateCompilationQueueItem,
  removeFromCompilationQueue,
  getPendingCompilations,
  cleanupCompilationQueue,
  reconcileStuckCompilations,
} from '@/src/services/storage';
import { type CompileRecordedVideos } from '@/src/services/api';
import { compileOnDevice } from '@/src/services/compile/compileOnDevice';
import { useCompileProgressStore } from '@/src/stores/useCompileProgressStore';
import { isFFmpegAvailable } from '@/src/services/compile/ffmpegAvailability';
import { hasInternetConnection, waitForConnection } from '@/src/services/network';
import type { MediaChoices } from '@/src/types';

type QueueItemResult = { id: string; success: boolean; error?: string };

type PendingItem = Awaited<ReturnType<typeof getPendingCompilations>>[number];

function noop(): undefined {
  return undefined;
}

async function processQueueItem(item: PendingItem, maxRetries: number): Promise<QueueItemResult | null> {
  if (item.retryCount >= maxRetries) {
    return null;
  }

  try {
    await updateCompilationQueueItem(item.id, {
      status: 'processing',
      lastRetryAt: new Date().toISOString(),
    });

    const result = await compileOnDevice(item.templateDescriptor, item.recordedVideos);

    if (result.success) {
      await updateCompilationQueueItem(item.id, {
        status: 'completed',
        lastRetryAt: new Date().toISOString(),
      });

      return { id: item.id, success: true };
    }

    await updateCompilationQueueItem(item.id, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastRetryAt: new Date().toISOString(),
      error: result.error,
    });

    return { id: item.id, success: false, error: result.error };
  } catch (error) {
    await updateCompilationQueueItem(item.id, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastRetryAt: new Date().toISOString(),
      error: (error as Error).message,
    });

    return {
      id: item.id,
      success: false,
      error: (error as Error).message,
    };
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processAllQueueItems(pendingItems: PendingItem[], maxRetries: number): Promise<QueueItemResult[]> {
  return pendingItems.reduce<Promise<QueueItemResult[]>>(
    (acc, item, index) =>
      acc.then(async (results) => {
        const result = await processQueueItem(item, maxRetries);

        if (result !== null) {
          results.push(result);
        }

        if (index < pendingItems.length - 1) {
          await delayMs(1000);
        }

        return results;
      }),
    Promise.resolve([])
  );
}

function invalidateQueueKeys(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ['compilation-queue'] }).catch(noop);
  queryClient.invalidateQueries({ queryKey: ['pending-compilations'] }).catch(noop);
}

/**
 * Hook for managing the compilation queue
 */
export const useCompilationQueue = () => {
  return useQuery({
    queryKey: ['compilation-queue'],
    queryFn: getCompilationQueue,
    refetchInterval: 5000,
  });
};

/**
 * Hook for getting pending compilations
 */
export const usePendingCompilations = () => {
  return useQuery({
    queryKey: ['pending-compilations'],
    queryFn: getPendingCompilations,
    refetchInterval: 5000,
  });
};

/**
 * Hook for adding video compilation to queue
 */
export const useQueueVideoCompilation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateDescriptor,
      recordedVideos,
      mediaChoices,
    }: {
      projectId: string;
      templateDescriptor: unknown;
      recordedVideos: CompileRecordedVideos;
      mediaChoices?: MediaChoices;
    }) => {
      // The app is fully local: the video renders on the phone right now and is never queued. Surface
      // success or failure inline (the caller shows the result or the error). Drive the global progress
      // overlay from the engine's live `compilation-progress` events.
      const progress = useCompileProgressStore.getState();
      progress.start();

      try {
        const result = await compileOnDevice(templateDescriptor, recordedVideos, {
          mediaChoices,
          onProgress: ({ ratio, stage }) => {
            useCompileProgressStore.getState().update(ratio, stage);
          },
        });

        return { immediate: true, result };
      } finally {
        progress.finish();
      }
    },
    onSuccess: () => {
      invalidateQueueKeys(queryClient);
    },
  });
};

/**
 * Hook for processing queued compilations
 */
export const useProcessQueuedCompilations = () => {
  const queryClient = useQueryClient();

  return useMutation<QueueItemResult[], Error, number>({
    mutationFn: async (maxRetries: number) => {
      // Offline is only a hard stop when there's no on-device engine to fall back on;
      // with the native engine present, on-device-capable items can still process offline.
      const isOnline = await hasInternetConnection();

      if (!isOnline && !isFFmpegAvailable()) {
        throw new Error('No internet connection for processing queue');
      }

      const pendingItems = await getPendingCompilations();

      return processAllQueueItems(pendingItems, maxRetries);
    },
    onSuccess: () => {
      invalidateQueueKeys(queryClient);
    },
  });
};

/**
 * Hook for retrying a specific queue item
 */
export const useRetryQueueItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const queue = await getCompilationQueue();
      const item = queue.find((q) => q.id === itemId);

      if (!item) {
        throw new Error(`Queue item ${itemId} not found`);
      }

      const isOnline = await hasInternetConnection();

      if (!isOnline) {
        throw new Error('No internet connection for retry');
      }

      await updateCompilationQueueItem(itemId, {
        status: 'processing',
        lastRetryAt: new Date().toISOString(),
      });

      try {
        const result = await compileOnDevice(item.templateDescriptor, item.recordedVideos);

        if (result.success) {
          await updateCompilationQueueItem(itemId, {
            status: 'completed',
            lastRetryAt: new Date().toISOString(),
          });

          return { success: true, result };
        }
        await updateCompilationQueueItem(itemId, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastRetryAt: new Date().toISOString(),
          error: result.error,
        });

        return { success: false, error: result.error };
      } catch (error) {
        await updateCompilationQueueItem(itemId, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastRetryAt: new Date().toISOString(),
          error: (error as Error).message,
        });

        throw error;
      }
    },
    onSuccess: () => {
      invalidateQueueKeys(queryClient);
    },
  });
};

/**
 * Hook for removing item from queue
 */
export const useRemoveQueueItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFromCompilationQueue,
    onSuccess: () => {
      invalidateQueueKeys(queryClient);
    },
  });
};

/**
 * Hook for cleaning up old completed items
 */
export const useCleanupQueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cleanupCompilationQueue,
    onSuccess: () => {
      invalidateQueueKeys(queryClient);
    },
  });
};

/**
 * Hook for cold-boot reconciliation of stuck compilations.
 *
 * If the app was killed mid-compile, items are left stuck in `processing` forever (the processor
 * never persisted a terminal state). Reset them once, on mount — items flipped back to `pending`
 * are then picked up by the drain effect. The query client is a stable reference, so this runs once
 * per cold boot, never on a render or a network flip.
 */
export const useColdBootReconciliation = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    reconcileStuckCompilations()
      .then((resetIds) => {
        if (resetIds.length === 0) {
          return;
        }

        invalidateQueueKeys(queryClient);
      })
      .catch((error) => {
        console.warn('Failed to reconcile stuck compilations:', error);
      });
  }, [queryClient]);
};

/**
 * Hook for auto-processing queue when coming online
 */
export const useAutoProcessQueue = (enabled = true) => {
  const processQueue = useProcessQueuedCompilations();

  return useMutation({
    mutationFn: async () => {
      if (!enabled) return;

      const hasConnection = await waitForConnection(10000);
      // 10 s
      if (!hasConnection) {
        throw new Error('Failed to establish stable internet connection');
      }

      await processQueue.mutateAsync(3); // Max 3 retries
    },
  });
};
