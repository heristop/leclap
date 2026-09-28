import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import { useSound } from '@/hooks/use-sound';
import { haptic } from '@/lib/haptics';
import { subscribe as onFrame } from '@/lib/ticker';
import {
  CLICK_CLAP_SECONDS,
  CLICK_SLAM_AT,
  clickClapFrame,
  clickClapRestarts,
  crossed,
  type ClapParts,
  type ClickClapFrame,
} from './clappy.logic';

// Stepped like the acts, on twos as the films animate (use-animation-clock.ts).
const FPS = 30;

/**
 * A clock for one-shot takes: seconds into the latest, stepped at FPS, or null before the first and once each
 * is over. `restart` starts a new take from zero, cutting short the one playing.
 */
const useTakeClock = (until: number): [number | null, () => void] => {
  const [take, setTake] = useState(0);
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (take === 0) return () => {};

    let start: number | undefined;
    const stop = onFrame((now) => {
      start ??= now;

      const elapsed = (now - start) / 1000;

      if (elapsed >= until) {
        stop();
        setSeconds(null);

        return;
      }

      setSeconds(Math.floor(elapsed * FPS) / FPS);
    });

    return stop;
  }, [take, until]);

  const restart = (): void => {
    setSeconds(0);
    setTake((last) => last + 1);
  };

  return [seconds, restart];
};

export interface ClickClap {
  /** The clap playing over the pose (clappy.logic.ts: clickClapFrame), or null between claps. */
  frame: ClickClapFrame | null;
  onClick: () => void;
  onPointerDown: (event: PointerEvent) => void;
}

/**
 * The clap a click on Clappy plays over his pose, whose own stick and arms are `rest`: the clack sounds on the
 * slam when the site's sound is on, and a tap gets a light haptic where the device has one. Under reduced motion
 * there is no clap to watch, so the clack answers the click on the spot.
 */
export const useClickClap = (rest: ClapParts): ClickClap => {
  const reduced = useReducedMotion() ?? false;
  const { clap } = useSound();
  const [seconds, restart] = useTakeClock(CLICK_CLAP_SECONDS);
  const [from, setFrom] = useState<ClapParts>(rest);
  const frame = seconds === null ? null : clickClapFrame(seconds, from, rest);
  // Where the clock stood when the clack was last considered, so each slam sounds once, however often this
  // re-renders; and whether the press that led to a click was a finger.
  const heard = useRef(-1);
  const touched = useRef(false);

  useEffect(() => {
    if (seconds === null) {
      heard.current = -1;

      return;
    }

    if (crossed(heard.current, seconds, CLICK_SLAM_AT)) clap();

    heard.current = seconds;
  }, [seconds, clap]);

  const onPointerDown = (event: PointerEvent): void => {
    touched.current = event.pointerType === 'touch';
  };

  const onClick = (): void => {
    // Within the tap itself, where a browser still lets a page buzz.
    if (touched.current) haptic('light');

    if (reduced) {
      clap();

      return;
    }

    if (!clickClapRestarts(seconds)) return;

    // From wherever the stick and the arms are, mid-clap included, so a clap on a clap doesn't jump.
    setFrom(frame ?? rest);
    restart();
  };

  return { frame, onClick, onPointerDown };
};
