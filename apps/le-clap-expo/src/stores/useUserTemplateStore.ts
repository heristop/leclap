import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TemplateDescriptor } from '@/src/types';

/** A custom template the user composed in the editor, persisted on-device. */
export interface UserTemplate {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  descriptor: TemplateDescriptor;
  source: 'user';
  createdAt: number;
  updatedAt: number;
}

export type UserTemplateInput = Pick<UserTemplate, 'id' | 'name' | 'description' | 'orientation' | 'descriptor'>;

interface UserTemplateStore {
  templates: UserTemplate[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  /** Create or update (matched by id). Returns the persisted template. */
  save: (input: UserTemplateInput) => UserTemplate;
  remove: (id: string) => void;
  duplicate: (id: string) => UserTemplate | null;
  getById: (id: string) => UserTemplate | undefined;
}

const randomId = (): string => `user-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

export const useUserTemplateStore = create<UserTemplateStore>()(
  persist(
    (set, get) => ({
      templates: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      save: (input) => {
        const now = Date.now();
        const existing = get().templates.find((t) => t.id === input.id);
        const template: UserTemplate = {
          ...input,
          source: 'user',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        set((state) => ({
          templates: existing
            ? state.templates.map((t) => (t.id === template.id ? template : t))
            : [template, ...state.templates],
        }));

        return template;
      },

      remove: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

      duplicate: (id) => {
        const source = get().templates.find((t) => t.id === id);
        if (!source) {
          return null;
        }
        const now = Date.now();
        const copy: UserTemplate = { ...source, id: randomId(), name: `${source.name} copy`, createdAt: now, updatedAt: now };
        set((state) => ({ templates: [copy, ...state.templates] }));

        return copy;
      },

      getById: (id) => get().templates.find((t) => t.id === id),
    }),
    {
      name: 'leclap.user-templates',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    }
  )
);
