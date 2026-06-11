import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Template } from '@/src/types';
import { hasInternetConnection } from '@/src/services/network';
import { useUserTemplateStore } from '@/src/stores/useUserTemplateStore';
import { useCompileMode, useSettingsHydrated } from '@/src/stores/useSettingsStore';
import { buildCatalog, findInCatalog } from '@/src/templates/catalog';
import { fetchTemplates, fetchTemplateByName } from '@/src/services/api';

/** Cloud catalog = the local catalog PLUS the server's scenarios (deduped by name). If the server is
 * unreachable we still return the local catalog — there is no separate "offline" state. */
const mergeServerTemplates = async (local: Template[]): Promise<Template[]> => {
  try {
    const server = await fetchTemplates();
    const names = new Set(local.map((t) => t.name));

    return [...local, ...server.filter((t) => !names.has(t.name))];
  } catch {
    return local;
  }
};

/**
 * Template list, sourced by the current mode (Settings → Local | Cloud):
 *   - Local → the bundled catalog + the user's on-device templates.
 *   - Cloud → that same local catalog merged with the server's `/templates`.
 * Keyed on the mode + user templates so switching mode (or editing a template) re-derives the list;
 * gated on store hydration so the first paint shows skeletons rather than an empty list.
 */
export const useTemplates = () => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const storeHydrated = useUserTemplateStore((state) => state.hasHydrated);
  const settingsHydrated = useSettingsHydrated();
  const mode = useCompileMode();

  return useQuery({
    queryKey: ['templates', mode, userTemplates],
    queryFn: async (): Promise<Template[]> => {
      const local = buildCatalog(userTemplates);

      if (mode === 'server') {
        return mergeServerTemplates(local);
      }

      return local;
    },
    enabled: storeHydrated && settingsHydrated,
    staleTime: 0,
    retry: false,
  });
};

/** Single-template lookup, mode-aware: local catalog first, then the server when in Cloud mode. */
export const useTemplate = (templateName: string) => {
  const userTemplates = useUserTemplateStore((state) => state.templates);
  const storeHydrated = useUserTemplateStore((state) => state.hasHydrated);
  const settingsHydrated = useSettingsHydrated();
  const mode = useCompileMode();

  return useQuery({
    queryKey: ['template', mode, templateName, userTemplates],
    queryFn: async (): Promise<Template> => {
      const local = findInCatalog(userTemplates, templateName);

      if (local) {
        return local;
      }

      if (mode === 'server') {
        return fetchTemplateByName(templateName);
      }

      throw new Error(`Template "${templateName}" not found in the local catalog`);
    },
    enabled: Boolean(templateName) && storeHydrated && settingsHydrated,
    staleTime: 0,
  });
};

/**
 * "Refresh" re-derives the local catalog and invalidates the queries so a Cloud-mode list re-fetches
 * the server's scenarios. Kept so callers like OfflineProvider keep working.
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
