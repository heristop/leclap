import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTemplates } from '@/src/services/api';
import type { Template } from '@/src/types';
import { getCachedTemplates, cacheTemplates, isTemplatesCacheStale } from '@/src/services/storage';
import { hasInternetConnection } from '@/src/services/network';
import { useUserTemplateStore } from '@/src/stores/useUserTemplateStore';
import { buildCatalog, findInCatalog } from '@/src/templates/catalog';

/**
 * Serverless template list: bundled samples + the user's on-device templates. No `/templates`
 * fetch. Keyed on the user-template array so creating/removing one re-renders the catalog;
 * gated on store hydration so the first paint shows skeletons rather than an empty list.
 */
export const useTemplates = () => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const hasHydrated = useUserTemplateStore((state) => state.hasHydrated);

  return useQuery({
    queryKey: ['templates', userTemplates],
    queryFn: async (): Promise<Template[]> => buildCatalog(userTemplates),
    enabled: hasHydrated,
    staleTime: 0,
    retry: false,
  });
};

/** Serverless single-template lookup across the local catalog (user templates then samples). */
export const useTemplate = (templateName: string) => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const hasHydrated = useUserTemplateStore((state) => state.hasHydrated);

  return useQuery({
    queryKey: ['template', templateName, userTemplates],
    queryFn: async (): Promise<Template> => {
      const found = findInCatalog(userTemplates, templateName);

      if (!found) {
        throw new Error(`Template "${templateName}" not found in the local catalog`);
      }

      return found;
    },
    enabled: Boolean(templateName) && hasHydrated,
    staleTime: 0,
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
    onSuccess: async (data) => {
      queryClient.setQueryData(['templates'], data);
      // Also invalidate individual template queries
      await queryClient.invalidateQueries({ queryKey: ['template'] });
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
        getCachedTemplates().then((cache) => Boolean(cache)),
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
