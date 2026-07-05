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
    // Single-flight: if a compile is already in flight, abort it before adopting the new one's
    // cancel handle, so the previous render can't keep running orphaned with no way to stop it.
    const { visible, cancel } = get();

    if (visible) {
      cancel?.();
    }
    set({ visible: true, ratio: 0, stage: '', cancelling: false, cancel: onCancel ?? null });
  },
  update: (ratio, stage) => {
    // Once cancelling, freeze the bar: the engine keeps emitting progress for frames already in
    // flight, and advancing under a "Cancelling…" label reads as if the cancel didn't take.
    if (get().cancelling) {
      return;
    }
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
