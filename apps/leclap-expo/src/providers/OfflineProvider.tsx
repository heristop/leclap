import React, { createContext, useContext, type ReactNode } from 'react';
import { useNetworkState, useOnlineStatusChange } from '@/src/hooks/useNetworkState';
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

  const refreshTemplates = useRefreshTemplates();

  // Refresh the cached templates when connectivity returns; nothing else depends on the network,
  // since compilation runs entirely on-device.
  useOnlineStatusChange(
    () => {
      refreshTemplates.mutateAsync().catch((error) => {
        console.warn('Failed to refresh templates:', error);
      });
    },
    () => {
      // Device went offline - no action needed
    }
  );

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
