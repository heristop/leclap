import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscribeToNetworkState, getNetworkState, hasInternetConnection, type NetworkState } from '@/src/services/network';

/**
 * Hook for monitoring network state with real-time updates
 */
export const useNetworkState = () => {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: false,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    // Get initial state
    getNetworkState().then(setNetworkState);

    // Subscribe to changes
    const unsubscribe = subscribeToNetworkState(setNetworkState);

    return unsubscribe;
  }, []);

  return networkState;
};

/**
 * Hook for checking internet connectivity with periodic updates
 */
export const useInternetConnectivity = (refetchInterval = 30000) => {
  return useQuery({
    queryKey: ['internet-connectivity'],
    queryFn: hasInternetConnection,
    refetchInterval,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

/**
 * Hook for network-aware operations
 */
export const useNetworkAware = () => {
  const networkState = useNetworkState();
  const { data: hasInternet = false } = useInternetConnectivity();

  return {
    ...networkState,
    hasInternet,
    isOnline: networkState.isConnected && hasInternet,
    isOffline: !networkState.isConnected || !hasInternet,
  };
};

/**
 * Hook for detecting when device comes back online
 */
export const useOnlineStatusChange = (onOnline?: () => void, onOffline?: () => void) => {
  const networkState = useNetworkState();
  const { data: hasInternet } = useInternetConnectivity();
  const [previouslyOnline, setPreviouslyOnline] = useState<boolean | null>(null);

  const isOnline = networkState.isConnected && hasInternet;

  useEffect(() => {
    if (previouslyOnline !== null) {
      if (!previouslyOnline && isOnline) {
        // Just came online
        onOnline?.();
      } else if (previouslyOnline && !isOnline) {
        // Just went offline
        onOffline?.();
      }
    }
    setPreviouslyOnline(isOnline);
  }, [isOnline, previouslyOnline, onOnline, onOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    networkState,
    hasInternet,
  };
};
