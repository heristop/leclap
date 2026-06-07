import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Template } from '@/src/types';
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
 * "Refresh" is a no-op against a local catalog (nothing to fetch). Kept so callers like
 * OfflineProvider keep working; it just re-derives the catalog and invalidates the queries.
 */
export const useRefreshTemplates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Template[]> => buildCatalog(useUserTemplateStore.getState().templates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      await queryClient.invalidateQueries({ queryKey: ['template'] });
    },
  });
};

/**
 * Sync status for a serverless catalog: there is nothing to sync, so `needsSync` is always
 * false. `isOnline` is still surfaced for the offline indicator.
 */
export const useTemplatesSyncStatus = () => {
  return useQuery({
    queryKey: ['templates-sync-status'],
    queryFn: async () => ({
      hasCache: true,
      isCacheStale: false,
      isOnline: await hasInternetConnection(),
      needsSync: false,
    }),
    refetchInterval: 30000, // Refresh the online indicator periodically
  });
};
