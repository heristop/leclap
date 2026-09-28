import { useSyncExternalStore } from 'react';
import { playClap, playTick } from '@/lib/clap';
import { INITIAL_SOUND, readSound, setSoundEnabled, subscribeSound } from '@/lib/landing-sound';

/** Closest two timeline blips may land, whatever the event rate driving them. */
const TICK_COOLDOWN_MS = 60;
let lastTickAt = 0;

/**
 * The landing's one sound (lib/landing-sound.ts), read live: its switch, its level, and whether the visitor
 * has found it, plus the hero's two gated one-shots. `clap` and `tick` are safe to call unconditionally —
 * they do nothing while the sound is off, so callers never branch on state.
 */
export function useSound() {
  const sound = useSyncExternalStore(subscribeSound, readSound, () => INITIAL_SOUND);

  // The hero's switch plays the thing being switched on, so the toggle demonstrates itself.
  const toggle = () => {
    const next = !readSound().enabled;

    setSoundEnabled(next);

    if (next) playClap();
  };

  const clap = () => {
    if (readSound().enabled) playClap();
  };

  const tick = () => {
    if (!readSound().enabled) return;

    // Dragging a scrubber fires continuously; a blip per event is a machine gun. Rate-limit here
    // rather than at the call site — how often a sound may retrigger is the sound's business.
    const now = performance.now();

    if (now - lastTickAt < TICK_COOLDOWN_MS) return;

    lastTickAt = now;
    playTick();
  };

  return { ...sound, toggle, clap, tick };
}
