import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Get current network state
 */
export const getNetworkState = async (): Promise<NetworkState> => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
  } catch {
    console.error('Error getting network state:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: null,
    };
  }
};

/**
 * Check if device has internet connectivity
 */
export const hasInternetConnection = async (): Promise<boolean> => {
  try {
    const state = await getNetworkState();
    return state.isConnected && (state.isInternetReachable ?? false);
  } catch {
    console.error('Error checking internet connection:', error);
    return false;
  }
};

/**
 * Subscribe to network state changes
 */
export const subscribeToNetworkState = (callback: (state: NetworkState) => void): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const networkState: NetworkState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
    callback(networkState);
  });

  return unsubscribe;
};

/**
 * Wait for internet connection with timeout
 */
export const waitForConnection = (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    // Check current state first
    hasInternetConnection().then((connected) => {
      if (connected) {
        cleanup();
        resolve(true);
        return;
      }

      // If not connected, wait for connection
      unsubscribe = subscribeToNetworkState((state) => {
        if (state.isConnected && state.isInternetReachable) {
          cleanup();
          resolve(true);
        }
      });
    });
  });
};

/**
 * Test actual connectivity by making a lightweight request
 */
export const testConnectivity = async (url: string = 'https://www.google.com'): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    console.error('Connectivity test failed:', error);
    return false;
  }
};
