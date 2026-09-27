import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { subscribe as onFrame } from '@/lib/ticker';
import { RESTING_GAZE, gazeSettled, gazeToward, stepGaze, type Gaze, type Look, type Point } from './clappy-gaze.logic';
import { readHoverPointer, subscribeHoverPointer } from './hover-pointer';

/**
 * The CSS properties the follower sets on Clappy's svg, in look units: its share of his look, which clappy.tsx
 * adds to the pose's as extra travel for the pupils and the face.
 */
export const GAZE_VAR = {
  eyesX: '--clappy-eyes-x',
  eyesY: '--clappy-eyes-y',
  faceX: '--clappy-face-x',
  faceY: '--clappy-face-y',
} as const;

// A pointer that can hover somewhere on the device: a mouse or a trackpad, even beside a touchscreen.
const HOVERS = '(any-hover: hover) and (any-pointer: fine)';

const AHEAD: Look = { x: 0, y: 0 };

// The first step after the loop wakes has no frame before it to measure from: it takes one at 60 fps.
const FIRST_STEP = 1 / 60;

interface Follower {
  /** The pose's own look, and whether his eyes may leave it for the pointer. */
  aim: (pose: Look, follow: boolean) => void;
  dispose: () => void;
}

/** Tells `onChange` whether `element` is on screen, now and as that changes; without an observer, it is. */
const watchOnScreen = (element: Element, onChange: (onScreen: boolean) => void): (() => void) => {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);

    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    const entry = entries.at(-1);

    if (entry) onChange(entry.isIntersecting);
  });

  observer.observe(element);

  return () => {
    observer.disconnect();
  };
};

/**
 * One Clappy's follower. It watches the shared pointer while he's on screen, springs his gaze toward it on the
 * shared frame loop, and writes the result straight onto his svg, so following costs React no render. The gaze
 * adds to the pose's look instead of replacing it: it eases to the pointer's look less the pose's, then back to
 * nothing when the pointer goes or his eyes may not follow, handing his look back to the pose, and whatever act
 * is driving it, without a jump. Settled, the loop stops until the pointer moves again.
 */
const followGaze = (svg: SVGSVGElement, eyes: Point): Follower => {
  let pose = AHEAD;
  let following = false;
  let onScreen = false;
  let target = AHEAD;
  let returning = true;
  let gaze: Gaze = RESTING_GAZE;
  let lastFrame = 0;
  let stopLoop: (() => void) | undefined;
  const written = new Map<string, string>();

  const write = (name: string, value: number): void => {
    // To a thousandth of a look, far below a pixel, so a spring's last creep writes nothing.
    const text = String(Math.round(value * 1000) / 1000);

    if (written.get(name) === text) return;

    written.set(name, text);
    svg.style.setProperty(name, text);
  };

  const step = (time: number): void => {
    const seconds = lastFrame === 0 ? FIRST_STEP : (time - lastFrame) / 1000;

    lastFrame = time;
    gaze = stepGaze(gaze, target, seconds, returning);
    write(GAZE_VAR.eyesX, gaze.eyes.x.value);
    write(GAZE_VAR.eyesY, gaze.eyes.y.value);
    write(GAZE_VAR.faceX, gaze.face.x.value);
    write(GAZE_VAR.faceY, gaze.face.y.value);

    if (!gazeSettled(gaze, target)) return;

    stopLoop?.();
    stopLoop = undefined;
  };

  const retarget = (): void => {
    const pointer = following && onScreen ? readHoverPointer() : null;
    const look = pointer === null ? pose : gazeToward(pointer, svg.getBoundingClientRect(), eyes);

    target = { x: look.x - pose.x, y: look.y - pose.y };
    // Losing a pointer he was free to follow, he drifts back slowly, losing interest; an act or a run taking his
    // look back gets it promptly.
    returning = following && pointer === null;

    if (stopLoop !== undefined || gazeSettled(gaze, target)) return;

    lastFrame = 0;
    stopLoop = onFrame(step);
  };

  const stopPointer = subscribeHoverPointer(retarget);
  const stopWatching = watchOnScreen(svg, (visible) => {
    onScreen = visible;
    retarget();
  });

  return {
    aim: (look, follow) => {
      pose = look;
      following = follow;
      retarget();
    },
    dispose: () => {
      stopLoop?.();
      stopPointer();
      stopWatching();

      for (const name of Object.values(GAZE_VAR)) {
        svg.style.removeProperty(name);
      }
    },
  };
};

export interface GazePose {
  /** The pose's own look, each -1..1. */
  lookX: number;
  lookY: number;
  /** Whether his eyes may leave it for the pointer. */
  follow: boolean;
}

/**
 * Clappy's eyes on the visitor's pointer, for the svg `svg` looking from `eyes` (a place in it, as a fraction of
 * its box). Only where a pointer can hover, and not at all under reduced motion.
 */
export const useClappyGaze = (
  svg: RefObject<SVGSVGElement | null>,
  eyes: Point,
  { lookX, lookY, follow }: GazePose
): void => {
  const reduced = useReducedMotion() ?? false;
  const hovers = useMediaQuery(HOVERS);
  const enabled = hovers && !reduced;
  const follower = useRef<Follower | null>(null);

  useEffect(() => {
    const element = svg.current;

    if (!enabled || element === null) return () => {};

    const created = followGaze(element, eyes);

    follower.current = created;

    return () => {
      created.dispose();
      follower.current = null;
    };
  }, [svg, eyes, enabled]);

  // Declared after the effect above, so a follower it has just made is aimed on the same commit.
  useEffect(() => {
    follower.current?.aim({ x: lookX, y: lookY }, follow);
  }, [enabled, lookX, lookY, follow]);
};
