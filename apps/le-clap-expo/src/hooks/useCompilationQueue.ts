import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addToCompilationQueue,
  getCompilationQueue,
  updateCompilationQueueItem,
  removeFromCompilationQueue,
  getPendingCompilations,
  cleanupCompilationQueue,
} from '@/src/services/storage';
import { compileVideo } from '@/src/services/api';
import { hasInternetConnection, waitForConnection } from '@/src/services/network';

/**
 * Hook for managing the compilation queue
 */
export const useCompilationQueue = () => {
  return useQuery({
    queryKey: ['compilation-queue'],
    queryFn: getCompilationQueue,
    refetchInterval: 5000, // Refetch every 5 seconds to update UI
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
      projectId,
      templateDescriptor,
      recordedVideos,
    }: {
      projectId: string;
      templateDescriptor: unknown;
      recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>;
    }) => {
      const isOnline = await hasInternetConnection();

      if (isOnline) {
        // Try immediate compilation if online
        try {
          const result = await compileVideo(templateDescriptor, recordedVideos);
          if (result.success) {
            return { immediate: true, result };
          }
        } catch (error) {
          console.warn('Immediate compilation failed, adding to queue:', error);
        }
      }

      // Add to queue for later processing
      const queueItemId = await addToCompilationQueue({
        projectId,
        templateDescriptor,
        recordedVideos,
        status: 'pending',
      });

      return { immediate: false, queueItemId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pending-compilations'] });
    },
  });
};

/**
 * Hook for processing queued compilations
 */
export const useProcessQueuedCompilations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (maxRetries = 3) => {
      const isOnline = await hasInternetConnection();
      if (!isOnline) {
        throw new Error('No internet connection for processing queue');
      }

      const pendingItems = await getPendingCompilations();
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const item of pendingItems) {
        // Skip if too many retries
        if (item.retryCount >= maxRetries) {
          continue;
        }

        try {
          // Update status to processing
          await updateCompilationQueueItem(item.id, {
            status: 'processing',
            lastRetryAt: new Date().toISOString(),
          });

          const result = await compileVideo(item.templateDescriptor, item.recordedVideos);

          if (result.success) {
            // Mark as completed
            await updateCompilationQueueItem(item.id, {
              status: 'completed',
              lastRetryAt: new Date().toISOString(),
            });

            results.push({ id: item.id, success: true });
          } else {
            // Mark as failed and increment retry count
            await updateCompilationQueueItem(item.id, {
              status: 'failed',
              retryCount: item.retryCount + 1,
              lastRetryAt: new Date().toISOString(),
              error: result.error,
            });

            results.push({ id: item.id, success: false, error: result.error });
          }
        } catch (error) {
          // Mark as failed and increment retry count
          await updateCompilationQueueItem(item.id, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            error: (error as Error).message,
          });

          results.push({
            id: item.id,
            success: false,
            error: (error as Error).message,
          });
        }

        // Small delay between processing items
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pending-compilations'] });
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

      // Update status to processing
      await updateCompilationQueueItem(itemId, {
        status: 'processing',
        lastRetryAt: new Date().toISOString(),
      });

      try {
        const result = await compileVideo(item.templateDescriptor, item.recordedVideos);

        if (result.success) {
          await updateCompilationQueueItem(itemId, {
            status: 'completed',
            lastRetryAt: new Date().toISOString(),
          });
          return { success: true, result };
        } else {
          await updateCompilationQueueItem(itemId, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            error: result.error,
          });
          return { success: false, error: result.error };
        }
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
      queryClient.invalidateQueries({ queryKey: ['compilation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pending-compilations'] });
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
      queryClient.invalidateQueries({ queryKey: ['compilation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pending-compilations'] });
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
      queryClient.invalidateQueries({ queryKey: ['compilation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pending-compilations'] });
    },
  });
};

/**
 * Hook for auto-processing queue when coming online
 */
export const useAutoProcessQueue = (enabled = true) => {
  const processQueue = useProcessQueuedCompilations();

  return useMutation({
    mutationFn: async () => {
      if (!enabled) return;

      // Wait for stable internet connection
      const hasConnection = await waitForConnection(10000); // 10 second timeout
      if (!hasConnection) {
        throw new Error('Failed to establish stable internet connection');
      }

      // Process the queue
      return processQueue.mutateAsync(3); // Max 3 retries
    },
  });
};
