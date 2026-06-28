import { create } from 'zustand';

// Live state of an in-flight on-device compilation, surfaced to the global CompileProgressOverlay.
// Not persisted — it only exists for the duration of a render. The compile hooks call start() before
// the engine runs, update(ratio, stage) from the engine's `compilation-progress` events, and finish()
// when it settles (success or error), driving the overlay's enter/exit.
interface CompileProgressStore {
  visible: boolean;
  /** Overall progress, 0..1. */
  ratio: number;
  /** Playful human-readable stage label (renderQuip) emitted by the engine. */
  stage: string;
  start: () => void;
  update: (ratio: number, stage: string) => void;
  finish: () => void;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const useCompileProgressStore = create<CompileProgressStore>((set) => ({
  visible: false,
  ratio: 0,
  stage: '',
  start: () => {
    set({ visible: true, ratio: 0, stage: '' });
  },
  update: (ratio, stage) => {
    set({ ratio: clamp01(ratio), stage });
  },
  finish: () => {
    set({ visible: false });
  },
}));
