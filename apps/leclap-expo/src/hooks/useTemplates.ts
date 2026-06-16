import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Template } from '@/src/types';
import { hasInternetConnection } from '@/src/services/network';
import { useUserTemplateStore } from '@/src/stores/useUserTemplateStore';
import { useSettingsHydrated } from '@/src/stores/useSettingsStore';
import { buildCatalog, findInCatalog } from '@/src/templates/catalog';

/**
 * Template list: the bundled @leclap/creative-kit catalog plus the user's on-device templates. The
 * app is fully local — there is no server fetch. Keyed on the user templates so editing one re-derives
 * the list; gated on store hydration so the first paint shows skeletons rather than an empty list.
 */
export const useTemplates = () => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const storeHydrated = useUserTemplateStore((state) => state.hasHydrated);
  const settingsHydrated = useSettingsHydrated();

  return useQuery({
    queryKey: ['templates', userTemplates],
    queryFn: async (): Promise<Template[]> => buildCatalog(userTemplates),
    enabled: storeHydrated && settingsHydrated,
    staleTime: 0,
    retry: false,
  });
};

/** Single-template lookup in the local catalog. */
export const useTemplate = (templateName: string) => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const storeHydrated = useUserTemplateStore((state) => state.hasHydrated);
  const settingsHydrated = useSettingsHydrated();

  return useQuery({
    queryKey: ['template', templateName, userTemplates],
    queryFn: async (): Promise<Template> => {
      const local = findInCatalog(userTemplates, templateName);

      if (local) {
        return local;
      }

      throw new Error(`Template "${templateName}" not found in the local catalog`);
    },
    enabled: Boolean(templateName) && storeHydrated && settingsHydrated,
    staleTime: 0,
  });
};

/** "Refresh" re-derives the local catalog and invalidates the queries. Kept so callers keep working. */
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

/** Online indicator (used by the header dot). The local catalog never needs syncing. */
export const useTemplatesSyncStatus = () => {
  return useQuery({
    queryKey: ['templates-sync-status'],
    queryFn: async () => ({
      hasCache: true,
      isCacheStale: false,
      isOnline: await hasInternetConnection(),
      needsSync: false,
    }),
    refetchInterval: 30000,
  });
};
