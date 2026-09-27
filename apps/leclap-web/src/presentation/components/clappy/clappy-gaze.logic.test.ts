import { describe, expect, it } from 'vitest';
import {
  GAZE_REACH,
  RESTING_GAZE,
  gazeSettled,
  gazeToward,
  mayFollow,
  springStep,
  stepGaze,
  type Gaze,
  type Look,
} from './clappy-gaze.logic';

const TAU = Math.PI * 2;

// A 150 px Clappy with his frame's corner at (100, 100), looking from between his eyes, 70% of the way down.
const box = { left: 100, top: 100, width: 150, height: 134 };
const eyes = { x: 0.5, y: 0.7 };
const eyeX = box.left + box.width * eyes.x;
const eyeY = box.top + box.height * eyes.y;

/** Where his eyes go for a pointer `dx`, `dy` px from them. */
const toward = (dx: number, dy: number): Look => gazeToward({ x: eyeX + dx, y: eyeY + dy }, box, eyes);

// The eye as clappy.tsx draws it, in the mark's 600 space: the white's inner edge (inside its 9-wide outline),
// and the pupil with its two highlights, which travel 10 × lookX and 11 × lookY from 3 below the centre.
const WHITE = { rx: 28.5, ry: 33.5 };
const PUPIL_PARTS = [
  { dx: 0, dy: 0, rx: 22, ry: 25 },
  { dx: 9, dy: -8, rx: 9, ry: 9 },
  { dx: -8, dy: 13, rx: 4.5, ry: 4.5 },
];

/** How far past the white's inner edge the pupil reaches for a look, in the mark's units (negative: inside). */
const overhang = ({ x, y }: Look): number => {
  const cx = x * 10;
  const cy = y * 11 + 3;
  let worst = Number.NEGATIVE_INFINITY;

  for (const part of PUPIL_PARTS) {
    for (let turn = 0; turn < 1; turn += 1 / 360) {
      const px = cx + part.dx + Math.cos(turn * TAU) * part.rx;
      const py = cy + part.dy + Math.sin(turn * TAU) * part.ry;
      const reach = Math.hypot(px / WHITE.rx, py / WHITE.ry);

      worst = Math.max(worst, ((reach - 1) * Math.hypot(px, py)) / reach);
    }
  }

  return worst;
};

describe('gazeToward', () => {
  it('looks straight ahead at a pointer between his eyes', () => {
    expect(toward(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('barely moves his eyes for a pointer right on top of him', () => {
    const { x, y } = toward(8, -6);

    expect(Math.hypot(x, y)).toBeLessThan(0.05);
  });

  it('turns toward a pointer to either side, above or below', () => {
    expect(toward(-300, 0).x).toBeLessThan(-0.45);
    expect(toward(300, 0).x).toBeGreaterThan(0.45);
    expect(toward(0, -300).y).toBeLessThan(-0.6);
    expect(toward(0, 300).y).toBeGreaterThan(0.3);
    expect(toward(-300, 0).y).toBeCloseTo(0);
    expect(toward(0, 300).x).toBeCloseTo(0);
  });

  it('looks from his eyes, not from the middle of his frame', () => {
    const level = gazeToward({ x: eyeX + 400, y: eyeY }, box, eyes);
    const middle = gazeToward({ x: eyeX + 400, y: eyeY }, box, { x: 0.5, y: 0.5 });

    expect(level.y).toBeCloseTo(0);
    expect(middle.y).toBeGreaterThan(0);
  });

  it('eases in with distance, then saturates at the rim of the whites and goes no further', () => {
    const looks = [10, 40, 120, 360, 1080].map((distance) => toward(distance, 0).x);

    expect(looks[0]).toBeGreaterThan(0);

    for (let index = 1; index < looks.length; index++) {
      expect(looks[index]).toBeGreaterThan(looks[index - 1]);
    }

    expect(toward(20_000, 0).x).toBeCloseTo(GAZE_REACH.x, 6);
    expect(toward(0, -20_000).y).toBeCloseTo(-GAZE_REACH.up, 6);
    expect(toward(0, 20_000).y).toBeCloseTo(GAZE_REACH.down, 6);
  });

  it('looks further up than down: the pupils sit low, with more white above them', () => {
    expect(-toward(0, -400).y).toBeGreaterThan(toward(0, 400).y);
  });

  it('keeps to the pointer’s direction, so a pointer on the diagonal draws a look along it', () => {
    for (const [dx, dy] of [
      [200, 200],
      [-150, 90],
      [40, -260],
    ]) {
      const { x, y } = toward(dx, dy);

      expect(Math.atan2(y, x)).toBeCloseTo(Math.atan2(dy, dx), 6);
    }
  });

  it('measures distance against his size: a bigger Clappy needs the pointer further off to look as far', () => {
    const big = { ...box, width: box.width * 3, height: box.height * 3 };
    const bigEyeX = big.left + big.width * eyes.x;
    const bigEyeY = big.top + big.height * eyes.y;

    expect(gazeToward({ x: bigEyeX + 200, y: bigEyeY }, big, eyes).x).toBeLessThan(toward(200, 0).x);
    expect(gazeToward({ x: bigEyeX + 600, y: bigEyeY }, big, eyes).x).toBeCloseTo(toward(200, 0).x, 6);
  });

  it('never carries the pupils past the whites, wherever the pointer is', () => {
    expect(overhang({ x: 0, y: 0 })).toBeLessThan(0);

    for (let turn = 0; turn < 1; turn += 1 / 72) {
      for (const distance of [30, 300, 3000, 30_000]) {
        const look = toward(Math.cos(turn * TAU) * distance, Math.sin(turn * TAU) * distance);

        expect(overhang(look)).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe('springStep', () => {
  const still = { value: 0, velocity: 0 };

  it('stays put on its target', () => {
    expect(springStep({ value: 0.4, velocity: 0 }, 0.4, 1 / 60, 0.3)).toEqual({ value: 0.4, velocity: 0 });
  });

  it('eases onto a new target from rest without overshooting it', () => {
    let spring = still;
    const values: number[] = [];

    for (let frame = 0; frame < 120; frame++) {
      spring = springStep(spring, 1, 1 / 60, 0.3);
      values.push(spring.value);
    }

    // Eased in: a lag that jumped toward the target would already be a third of the way there.
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(0.1);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(spring).toEqual({ value: 1, velocity: 0 });
  });

  it('gets there in about its response', () => {
    let spring = still;

    for (let frame = 0; frame < 20; frame++) {
      spring = springStep(spring, 1, 1 / 60, 0.3);
    }

    expect(spring.value).toBeGreaterThan(0.95);
  });

  it('moves the same however the frames fall', () => {
    const long = springStep({ value: 0.2, velocity: 1.5 }, 1, 1 / 30, 0.3);
    const short = springStep(springStep({ value: 0.2, velocity: 1.5 }, 1, 1 / 60, 0.3), 1, 1 / 60, 0.3);

    expect(short.value).toBeCloseTo(long.value, 12);
    expect(short.velocity).toBeCloseTo(long.velocity, 12);
  });

  it('carries its speed into a new target instead of stopping dead', () => {
    let spring = still;

    for (let frame = 0; frame < 6; frame++) {
      spring = springStep(spring, 1, 1 / 60, 0.3);
    }

    const turned = springStep(spring, -1, 0.0001, 0.3);

    expect(turned.velocity).toBeGreaterThan(spring.velocity * 0.95);
  });
});

describe('stepGaze', () => {
  const target = { x: 0.5, y: -0.4 };

  /** The gaze `seconds` after setting off from `gaze`, stepped at 60 fps. */
  const after = (seconds: number, returning: boolean, gaze: Gaze = RESTING_GAZE, to: Look = target): Gaze => {
    let moved = gaze;

    for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
      moved = stepGaze(moved, to, 1 / 60, returning);
    }

    return moved;
  };

  it('leads with the pupils; the face turns after them', () => {
    const { eyes, face } = after(0.12, false);

    expect(eyes.x.value).toBeGreaterThan(face.x.value * 1.5);
    expect(eyes.y.value).toBeLessThan(face.y.value * 1.5);
  });

  it('gets there within a second, and settles', () => {
    const arrived = after(1, false);

    expect(gazeSettled(arrived, target)).toBe(true);
    expect(arrived.eyes.x.value).toBe(target.x);
    expect(arrived.face.y.value).toBe(target.y);
  });

  it('drifts back to his own look more slowly than it follows', () => {
    const looking = after(1, false);
    const straight = { x: 0, y: 0 };
    const back = after(0.2, true, looking, straight);
    const followed = after(0.2, false, looking, straight);

    expect(back.eyes.x.value).toBeGreaterThan(followed.eyes.x.value);
    expect(back.face.x.value).toBeGreaterThan(followed.face.x.value);
  });
});

describe('mayFollow', () => {
  it('lets his eyes follow in any pose he can see from', () => {
    expect(mayFollow({})).toBe(true);
    expect(mayFollow({ mood: 'wow', lookX: 0.4 })).toBe(true);
  });

  it('keeps them to himself asleep, eyes shut, and running, eyes on the track', () => {
    expect(mayFollow({ mood: 'sleepy' })).toBe(false);
    expect(mayFollow({ mood: 'smile', stride: 0.3 })).toBe(false);
    expect(mayFollow({ mood: 'smile', stride: 0 })).toBe(false);
  });
});

describe('gazeSettled', () => {
  it('is settled at rest on the target, and not while moving or elsewhere', () => {
    expect(gazeSettled(RESTING_GAZE, { x: 0, y: 0 })).toBe(true);
    expect(gazeSettled(RESTING_GAZE, { x: 0.2, y: 0 })).toBe(false);

    const moving = stepGaze(RESTING_GAZE, { x: 0.2, y: 0 }, 1 / 60, false);

    expect(gazeSettled(moving, { x: 0.2, y: 0 })).toBe(false);
  });
});
