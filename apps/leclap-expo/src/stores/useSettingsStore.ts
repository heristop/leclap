import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMmkvStorage } from '@/src/services/mmkv';

/**
 * How the section builder walks the template, matching the web app's two interchangeable shapes:
 * - 'linear': one focused screen per section, in order, gated (default, like web);
 * - 'hub': a single page listing every section, completed in any order.
 */
export type WizardMode = 'linear' | 'hub';

interface SettingsStore {
  /** Builder shape: 'linear' (default) or 'hub'. */
  wizardMode: WizardMode;
  hasHydrated: boolean;
  setWizardMode: (mode: WizardMode) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      wizardMode: 'linear', // default: step-by-step, matching web
      hasHydrated: false,
      setWizardMode: (wizardMode) => set({ wizardMode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'leclap.settings',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({ wizardMode: state.wizardMode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// React selectors.
export const useWizardMode = () => useSettingsStore((state) => state.wizardMode);
export const useSetWizardMode = () => useSettingsStore((state) => state.setWizardMode);
export const useSettingsHydrated = () => useSettingsStore((state) => state.hasHydrated);
