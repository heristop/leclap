import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

// The single on-device key/value store backing all local persistence: saved projects, settings,
// user templates, the template cache, and the compile queue. Replaces AsyncStorage — synchronous
// (no await / rehydration flash) and ~30x faster. It is a native TurboModule, so it only runs in
// the app's dev/release build, never Expo Go — which the app already requires for its on-device
// FFmpeg native module.
export const storage = new MMKV();

// zustand `persist` adapter. Synchronous, so stores rehydrate in one tick (no async hydration flash);
// the existing `onRehydrateStorage`/`setHasHydrated` callbacks still fire, just immediately.
export const zustandMmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.delete(name);
  },
};

// AsyncStorage-shaped async facade for the service/repository modules that `await` storage I/O, so
// they migrate with a one-line import swap while keeping their async signatures at the call site.
export const appStorage = {
  getItem: async (key: string): Promise<string | null> => storage.getString(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.delete(key);
  },
};
