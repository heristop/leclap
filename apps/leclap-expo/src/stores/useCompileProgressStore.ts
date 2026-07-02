import { create } from 'zustand';

// Live state of an in-flight on-device compilation, surfaced to the global CompileProgressOverlay.
// Not persisted — it only exists for the duration of a render. The compile hooks call start() before
// the engine runs, update(ratio, stage) from the engine's `compilation-progress` events, and finish()
// when it settles (success or error), driving the overlay's enter/exit. start() also registers a
// cancel handle (aborting the compile's AbortController); the overlay's Cancel button calls
// requestCancel() to invoke it.
interface CompileProgressStore {
  visible: boolean;
  /** Overall progress, 0..1. */
  ratio: number;
  /** Playful human-readable stage label (renderQuip) emitted by the engine. */
  stage: string;
  /** True once the user has asked to cancel, until finish() settles — drives the overlay's dimmed state. */
  cancelling: boolean;
  /** Aborts the in-flight compile; set by start(), cleared by finish(). */
  cancel: (() => void) | null;
  start: (onCancel?: () => void) => void;
  update: (ratio: number, stage: string) => void;
  requestCancel: () => void;
  finish: () => void;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const useCompileProgressStore = create<CompileProgressStore>((set, get) => ({
  visible: false,
  ratio: 0,
  stage: '',
  cancelling: false,
  cancel: null,
  start: (onCancel) => {
    set({ visible: true, ratio: 0, stage: '', cancelling: false, cancel: onCancel ?? null });
  },
  update: (ratio, stage) => {
    set({ ratio: clamp01(ratio), stage });
  },
  requestCancel: () => {
    if (get().cancelling) {
      return;
    }

    const { cancel } = get();
    set({ cancelling: true });
    cancel?.();
  },
  finish: () => {
    set({ visible: false, cancelling: false, cancel: null });
  },
}));
