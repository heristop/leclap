// Drop keys that are undefined or empty-string so the descriptor only carries fields the author
// actually set, while keeping meaningful 0 / false values (e.g. fontsize 0, box false).
export function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}
