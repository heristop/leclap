import { useCallback, useSyncExternalStore } from 'react';
import { playClap, playTick } from '@/lib/clap';

const STORAGE_KEY = 'leclap.sound';

// Off until asked for. A landing page that makes noise at a visitor who didn't ask is a landing page
// people close, so the preference starts false and is only ever flipped by the toggle.
let enabled = false;
let hydrated = false;

/** Closest two timeline blips may land, whatever the event rate driving them. */
const TICK_COOLDOWN_MS = 60;
let lastTickAt = 0;

const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    // Unguarded on purpose: `localStorage` is absent during prerender and throws when blocked, and
    // the catch below is the single place both are handled.
    return globalThis.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    // Private-mode Safari and cookie-blocked contexts throw on access; silence is the safe default.
    return false;
  }
}

function snapshot(): boolean {
  if (!hydrated) {
    hydrated = true;
    enabled = readStored();
  }

  return enabled;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function setEnabled(next: boolean): void {
  enabled = next;
  hydrated = true;

  try {
    globalThis.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
  } catch {
    // Preference is still honoured for this session even when it cannot be persisted.
  }

  // Snapshot so a listener that unsubscribes on notify doesn't disturb this pass.
  const due = [...listeners];

  for (const listener of due) {
    listener();
  }
}

/**
 * The hero's sound: an opt-in preference plus the two gated one-shots. `clap` and `tick` are safe to
 * call unconditionally — they do nothing while sound is off, so callers never branch on state.
 */
export function useSound() {
  const isEnabled = useSyncExternalStore(subscribe, snapshot, () => false);

  const toggle = useCallback(() => {
    const next = !snapshot();

    setEnabled(next);

    // Play the thing being switched on, so the toggle demonstrates itself.
    if (next) playClap();
  }, []);

  const clap = useCallback(() => {
    if (snapshot()) playClap();
  }, []);

  const tick = useCallback(() => {
    if (!snapshot()) return;

    // Dragging a scrubber fires continuously; a blip per event is a machine gun. Rate-limit here
    // rather than at the call site — how often a sound may retrigger is the sound's business.
    const now = performance.now();

    if (now - lastTickAt < TICK_COOLDOWN_MS) return;

    lastTickAt = now;
    playTick();
  }, []);

  return { enabled: isEnabled, toggle, clap, tick };
}
