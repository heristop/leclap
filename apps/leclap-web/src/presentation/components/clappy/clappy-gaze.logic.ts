import type { ClappyPose } from './clappy.logic';

// How Clappy's eyes follow the visitor's pointer, as pure maths so it is tested once: where a pointer draws
// his look, and the critically damped springs that carry it there, the pupils first and the face after them.
// Looks are in the pose's units (clappy.logic.ts: lookX, lookY); times are in seconds.

/**
 * Whether a pose leaves his eyes free for the pointer: not asleep, with them shut, and not running, with them
 * on the track ahead, whoever is driving the run.
 */
export const mayFollow = ({ mood, stride }: ClappyPose): boolean => mood !== 'sleepy' && stride === undefined;

/** A place on the page in px, or a place in Clappy's frame as a fraction of it. */
export interface Point {
  x: number;
  y: number;
}

/** Where Clappy looks, in the pose's lookX / lookY units. */
export interface Look {
  x: number;
  y: number;
}

/** Clappy's frame on the page, in px: the box of its DOMRect. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TAU = Math.PI * 2;

/**
 * How far the follow may carry the pupils, in look units, to either side, up and down: to the inner edge of the
 * whites and no further, so the outline never eats into a pupil the way a brief glance of an act may. clappy.tsx
 * draws the pupils sitting a little low, so there is more white above them.
 */
export const GAZE_REACH = { x: 0.58, up: 0.8, down: 0.4 } as const;

/**
 * Where a pointer draws Clappy's eyes: toward it from between his `eyes` (a place in his `box`), easing in with
 * distance, since a pointer on his face is barely worth a glance, and saturating at the rim of the whites along
 * the pointer's own direction, so the look stays on the line to it. Distance counts in his widths: a bigger
 * Clappy needs the pointer further off to look as far.
 */
export const gazeToward = (pointer: Point, box: Box, eyes: Point): Look => {
  const dx = pointer.x - (box.left + box.width * eyes.x);
  const dy = pointer.y - (box.top + box.height * eyes.y);
  const distance = Math.hypot(dx, dy);

  if (distance === 0) return { x: 0, y: 0 };

  const across = dx / distance;
  const down = dy / distance;
  const rim = 1 / Math.hypot(across / GAZE_REACH.x, down / (down < 0 ? GAZE_REACH.up : GAZE_REACH.down));
  const pull = 1 - Math.exp(-distance / box.width);

  return { x: across * rim * pull, y: down * rim * pull };
};

// ── The springs ─────────────────────────────────────────────────────────────────────────────────────

/** One axis of a look in motion: where it is, and how fast it is going, in look units a second. */
export interface Spring {
  value: number;
  velocity: number;
}

// Close enough to call it there: a thousandth of a look is a hundredth of the mark's unit, far below a pixel.
const REST_DISTANCE = 0.001;
const REST_SPEED = 0.01;

/**
 * A critically damped spring `seconds` further on toward `target`: no overshoot from rest, no ringing, and the
 * speed it already had carried into a new target rather than dropped. `response` is about how long it takes to
 * get there, in seconds (the response of Apple's springs). Solved exactly, so it moves the same however the
 * frames fall; once it has all but arrived it lands on the target, so the loop driving it can stop.
 */
export const springStep = ({ value, velocity }: Spring, target: number, seconds: number, response: number): Spring => {
  const omega = TAU / response;
  const offset = value - target;
  const drift = velocity + omega * offset;
  const decay = Math.exp(-omega * seconds);
  const next = {
    value: target + (offset + drift * seconds) * decay,
    velocity: (velocity - omega * drift * seconds) * decay,
  };

  if (Math.abs(next.value - target) < REST_DISTANCE && Math.abs(next.velocity) < REST_SPEED) {
    return { value: target, velocity: 0 };
  }

  return next;
};

/** A look in motion, each axis its own spring, so a diagonal move stays straight. */
export interface MovingLook {
  x: Spring;
  y: Spring;
}

/** The follow's two moving parts: the pupils, and the face turning after them. */
export interface Gaze {
  eyes: MovingLook;
  face: MovingLook;
}

const STILL: Spring = { value: 0, velocity: 0 };

/** A gaze at rest adding nothing: Clappy looks where his pose says. */
export const RESTING_GAZE: Gaze = { eyes: { x: STILL, y: STILL }, face: { x: STILL, y: STILL } };

// How long each part takes to get there, in seconds. Following, the pupils lead and the face turns after them,
// which reads as looking rather than sliding. Drifting back, once the pointer rests or leaves, both take their
// time: losing interest, not snapping to attention.
const FOLLOW = { eyes: 0.24, face: 0.5 };
const RETURN = { eyes: 0.7, face: 0.9 };

const stepLook = (look: MovingLook, target: Look, seconds: number, response: number): MovingLook => ({
  x: springStep(look.x, target.x, seconds, response),
  y: springStep(look.y, target.y, seconds, response),
});

/** The gaze `seconds` further on toward `target`; `returning` while it drifts back to his own look. */
export const stepGaze = (gaze: Gaze, target: Look, seconds: number, returning: boolean): Gaze => {
  const response = returning ? RETURN : FOLLOW;

  return {
    eyes: stepLook(gaze.eyes, target, seconds, response.eyes),
    face: stepLook(gaze.face, target, seconds, response.face),
  };
};

const landed = ({ value, velocity }: Spring, target: number): boolean => value === target && velocity === 0;

/** Whether the gaze has landed on `target` and stopped: nothing left to move. */
export const gazeSettled = ({ eyes, face }: Gaze, target: Look): boolean =>
  landed(eyes.x, target.x) && landed(eyes.y, target.y) && landed(face.x, target.x) && landed(face.y, target.y);
