import { useEffect, useState } from 'react';

interface AnimationClockOptions {
  /** Steps per second: 30 animates on twos, like the films. */
  fps?: number;
  /** Where the clock stops by itself, in seconds. */
  until?: number;
}

/**
 * Seconds since the clock started, read off the display's frame clock and stepped at `fps`. It starts on the
 * first frame the page actually paints (a tab opened in the background starts it when the visitor looks, not
 * while they are away), stops by itself at `until`, and holds still while `running` is off; turning it back
 * on starts it over.
 */
export const useAnimationClock = (
  running: boolean,
  { fps = 30, until = Number.POSITIVE_INFINITY }: AnimationClockOptions = {}
): number => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return () => {};

    let start: number | undefined;
    let request = 0;

    const tick = (now: number) => {
      start ??= now;

      const elapsed = (now - start) / 1000;

      if (elapsed >= until) {
        setSeconds(until);

        return;
      }

      setSeconds(Math.floor(elapsed * fps) / fps);
      request = requestAnimationFrame(tick);
    };

    request = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(request);
    };
  }, [running, fps, until]);

  return seconds;
};
