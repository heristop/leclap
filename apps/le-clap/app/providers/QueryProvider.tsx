import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, useEffect } from 'react';
import { hasInternetConnection } from '../services/network';

// Create persister for offline caching
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'TANSTACK_QUERY_OFFLINE_CACHE',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Retry less aggressively when offline
        return failureCount < 2;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (extended for offline)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst', // Allow queries to work offline
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations when offline
        return failureCount < 1;
      },
      networkMode: 'online', // Mutations require online connection
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

// Export query client for use in other parts of the app
export { queryClient };

export function QueryProvider({ children }: QueryProviderProps) {
  useEffect(() => {
    // Initialize persistence on app start
    try {
      persistQueryClient({
        queryClient,
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        hydrateOptions: {
          // Only hydrate if we have cached data
          defaultOptions: {
            queries: {
              staleTime: 10 * 60 * 1000, // Consider hydrated data stale after 10 minutes
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to persist query client:', error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}