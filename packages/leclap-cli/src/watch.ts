import { watch as fsWatch } from 'node:fs';

// Watch a set of paths (a template file + its assets dir) and call `onChange` after a debounce window,
// so a burst of writes (editors save in several syscalls) triggers a single re-render. A path that
// can't be watched (e.g. a missing assets dir) is skipped silently. Returns a stop() that tears down
// every watcher and any pending timer. Native fs.watch only — no extra dependency.
export function watchPaths(paths: string[], onChange: () => void, debounceMs = 150): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = (): void => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(onChange, debounceMs);
  };

  const watchers = paths.map((target) => {
    try {
      return fsWatch(target, { recursive: true }, fire);
    } catch {
      return null;
    }
  });

  return () => {
    for (const watcher of watchers) {
      watcher?.close();
    }

    if (timer) {
      clearTimeout(timer);
    }
  };
}
