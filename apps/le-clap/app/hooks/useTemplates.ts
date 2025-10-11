import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTemplates, fetchTemplateByName } from '../services/api';
import { Template } from '../types';
import { getCachedTemplates, cacheTemplates, isTemplatesCacheStale } from '../services/storage';
import { hasInternetConnection } from '../services/network';

export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<Template[]> => {
      const isOnline = await hasInternetConnection();
      const cachedTemplates = await getCachedTemplates();
      const isCacheStale = await isTemplatesCacheStale();

      // If offline, return cached data if available
      if (!isOnline) {
        if (cachedTemplates) {
          return cachedTemplates;
        }
        throw new Error('No internet connection and no cached templates available');
      }

      // If online but cache is fresh, return cached data
      if (cachedTemplates && !isCacheStale) {
        return cachedTemplates;
      }

      // Fetch fresh data and cache it
      try {
        const freshTemplates = await fetchTemplates();
        await cacheTemplates(freshTemplates);
        return freshTemplates;
      } catch (error) {
        // If fetch fails but we have cached data, return it
        if (cachedTemplates) {
          console.warn('Failed to fetch fresh templates, using cached data:', error);
          return cachedTemplates;
        }
        throw error;
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: (failureCount, error) => {
      // Don't retry if we have cached data
      return failureCount < 2 && !getCachedTemplates();
    },
  });
};

export const useTemplate = (templateName: string) => {
  return useQuery({
    queryKey: ['template', templateName],
    queryFn: async (): Promise<Template> => {
      const isOnline = await hasInternetConnection();
      const cachedTemplates = await getCachedTemplates();

      // Try to find template in cache first
      if (cachedTemplates) {
        const cachedTemplate = cachedTemplates.find((t) => t.name === templateName);
        if (cachedTemplate) {
          // If offline or cache is fresh, return cached template
          if (!isOnline || !(await isTemplatesCacheStale())) {
            return cachedTemplate;
          }
        }
      }

      // If online, try to fetch fresh data
      if (isOnline) {
        try {
          return await fetchTemplateByName(templateName);
        } catch (error) {
          // If fetch fails but we have cached template, return it
          if (cachedTemplates) {
            const cachedTemplate = cachedTemplates.find((t) => t.name === templateName);
            if (cachedTemplate) {
              console.warn(`Failed to fetch template ${templateName}, using cached data:`, error);
              return cachedTemplate;
            }
          }
          throw error;
        }
      }

      // No cached data and offline
      throw new Error(`Template ${templateName} not available offline`);
    },
    enabled: !!templateName,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Force refresh templates from server
 */
export const useRefreshTemplates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Template[]> => {
      const freshTemplates = await fetchTemplates();
      await cacheTemplates(freshTemplates);
      return freshTemplates;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['templates'], data);
      // Also invalidate individual template queries
      queryClient.invalidateQueries({ queryKey: ['template'] });
    },
  });
};

/**
 * Get templates sync status
 */
export const useTemplatesSyncStatus = () => {
  return useQuery({
    queryKey: ['templates-sync-status'],
    queryFn: async () => {
      const [hasCache, isCacheStale, isOnline] = await Promise.all([
        getCachedTemplates().then((cache) => !!cache),
        isTemplatesCacheStale(),
        hasInternetConnection(),
      ]);

      return {
        hasCache,
        isCacheStale,
        isOnline,
        needsSync: isCacheStale && isOnline,
      };
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
};
