import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isServerOptionEnabled } from '@/src/config/runtime';

export type CompileMode = 'local' | 'server';

interface SettingsStore {
  /** Where compilation runs: 'local' (on-device, default) or 'server'. */
  compileMode: CompileMode;
  hasHydrated: boolean;
  setCompileMode: (mode: CompileMode) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      compileMode: 'local', // default: fully serverless / on-device
      hasHydrated: false,
      setCompileMode: (compileMode) => set({ compileMode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'leclap.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ compileMode: state.compileMode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * The mode the router should actually use. When the server option is disabled at build time
 * (`EXPO_PUBLIC_ENABLE_SERVER=false`), 'server' is never honoured — the app stays on-device.
 * Safe to call outside React (e.g. in compileHybrid).
 */
export const resolveCompileMode = (): CompileMode => {
  if (!isServerOptionEnabled()) {
    return 'local';
  }

  return useSettingsStore.getState().compileMode;
};

// React selectors.
export const useCompileMode = () => useSettingsStore((state) => state.compileMode);
export const useSetCompileMode = () => useSettingsStore((state) => state.setCompileMode);
export const useSettingsHydrated = () => useSettingsStore((state) => state.hasHydrated);
