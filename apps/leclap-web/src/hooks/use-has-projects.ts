import { useSyncExternalStore } from 'react';
import { projectStore } from '@/stores/projectStore';

// Writes from this tab arrive through the store. A project saved or deleted in another tab rewrites
// the same localStorage entry, which the browser reports here as a `storage` event — it never fires
// in the tab that made the write, so the two sources don't double up.
const subscribe = (onChange: () => void): (() => void) => {
  const unsubscribe = projectStore.subscribe(onChange);
  window.addEventListener('storage', onChange);

  return () => {
    unsubscribe();
    window.removeEventListener('storage', onChange);
  };
};

const snapshot = (): boolean => projectStore.list().length > 0;

/**
 * Whether this browser has at least one saved project — live, so the first auto-save brings the
 * header's Projects link in and deleting the last project takes it out, without a reload. The read
 * is synchronous localStorage, so the first paint already has the answer and the nav never shifts;
 * with no client to ask, it reports none.
 */
export const useHasProjects = (): boolean => useSyncExternalStore(subscribe, snapshot, () => false);
