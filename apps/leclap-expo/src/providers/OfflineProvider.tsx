import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useNetworkState, useOnlineStatusChange } from '@/src/hooks/useNetworkState';
import {
  useAutoProcessQueue,
  useCleanupQueue,
  useCompilationQueue,
  useProcessQueuedCompilations,
} from '@/src/hooks/useCompilationQueue';
import { isFFmpegAvailable } from '@/src/services/compile/ffmpegAvailability';
import { useRefreshTemplates } from '@/src/hooks/useTemplates';

interface OfflineContextType {
  isOnline: boolean;
  isOffline: boolean;
  networkType: string | null;
  hasInternet: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const networkState = useNetworkState();

  const isOnline = networkState.isConnected && (networkState.isInternetReachable ?? false);
  const isOffline = !isOnline;

  // QueryClient-dependent hooks
  const autoProcessQueue = useAutoProcessQueue();
  const cleanupQueue = useCleanupQueue();
  const refreshTemplates = useRefreshTemplates();

  // Handle network state changes
  useOnlineStatusChange(
    () => {
      // Process queued compilations
      autoProcessQueue.mutateAsync().catch((error) => {
        console.error('Failed to process compilation queue:', error);
      });

      // Refresh templates if needed
      refreshTemplates.mutateAsync().catch((error) => {
        console.warn('Failed to refresh templates:', error);
      });

      // Cleanup old queue items
      cleanupQueue.mutateAsync().catch((error) => {
        console.warn('Failed to cleanup queue:', error);
      });
    },
    () => {
      // Device went offline - no action needed
    }
  );

  // Drain the queue in steady state — not only on an offline→online transition. Without this, items
  // queued while already online (the common case) sit at "pending" forever even though the banner
  // says "processing in background". Fires whenever the pending count rises and we can process
  // (online, or the native engine is present so on-device-capable jobs run offline).
  const queue = useCompilationQueue();
  const processQueue = useProcessQueuedCompilations();
  const pendingCount = (queue.data ?? []).filter((item) => item.status === 'pending').length;
  const canProcess = isOnline || isFFmpegAvailable();

  const processQueueRef = useRef(processQueue);
  processQueueRef.current = processQueue;

  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    if (!canProcess) {
      return;
    }

    if (processQueueRef.current.isPending) {
      return;
    }

    processQueueRef.current.mutate(3);
  }, [pendingCount, canProcess]);

  // Keep the mutation in a ref: react-query recreates the mutation object every render, so
  // depending on it here re-ran this effect (and reset the interval) on every render.
  const cleanupQueueRef = useRef(cleanupQueue);
  cleanupQueueRef.current = cleanupQueue;

  // Periodic cleanup when online
  useEffect(() => {
    if (!isOnline) {
      return () => {};
    }

    const interval = setInterval(
      () => {
        cleanupQueueRef.current.mutateAsync().catch((error) => {
          console.warn('Periodic cleanup failed:', error);
        });
      },
      60 * 60 * 1000
    ); // Every hour

    return () => {
      clearInterval(interval);
    };
  }, [isOnline]);

  const contextValue: OfflineContextType = {
    isOnline,
    isOffline,
    networkType: networkState.type,
    hasInternet: networkState.isInternetReachable ?? false,
  };

  return <OfflineContext.Provider value={contextValue}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const context = useContext(OfflineContext);

  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }

  return context;
}
