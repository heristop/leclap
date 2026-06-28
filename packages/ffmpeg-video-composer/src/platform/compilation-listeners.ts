import type { IEventEmitter } from './AbstractEventManager';

export interface CompilationListeners {
  // Reads any error captured from a `task-stopped` event during compilation.
  getError: () => unknown;
  // Removes the listeners from the emitter.
  detach: () => void;
}

// Subscribe a caller's progress callback and capture any `task-stopped` error on a compilation
// emitter, returning a handle to read the error and detach again. Shared by the browser entry and the
// Node `compile()` so both forward the director's per-segment progress (0..1) identically. The emitter
// can be a singleton (browser) reused across compilations, so `detach()` must be called once a
// compilation settles to stop listeners accumulating and double-firing on the next run.
export function attachCompilationListeners(
  emitter: IEventEmitter,
  onProgress?: (progress: number) => void
): CompilationListeners {
  let compilationError: unknown = null;

  const onStopped = (err: unknown): void => {
    compilationError = err;
  };

  const onProgressEvent = (fraction: unknown): void => {
    onProgress?.(typeof fraction === 'number' ? fraction : 0);
  };

  emitter.on('task-stopped', onStopped);
  emitter.on('compilation-progress', onProgressEvent);

  return {
    getError: () => compilationError,
    detach: () => {
      emitter.off?.('task-stopped', onStopped);
      emitter.off?.('compilation-progress', onProgressEvent);
    },
  };
}
