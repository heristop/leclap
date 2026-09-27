import { describe, expect, it } from 'vitest';
import {
  CHEER_SECONDS,
  CUT_SLAM_AT,
  REACTION_SECONDS,
  REST_ANGLE,
  RUN_CADENCE,
  SLAM_AT,
  cheerFrame,
  crossed,
  feet,
  footStep,
  reactionFrame,
  runnerFrame,
  springProgress,
  type ClappyReaction,
} from './clappy.logic';

const running = { done: false, still: false };

describe('footStep', () => {
  it('stands still without a stride', () => {
    expect(footStep(undefined)).toEqual({ dx: 0, dy: 0 });
  });

  it('lifts the foot at the top of its arc and keeps it planted through the second half-turn', () => {
    expect(footStep(0.25).dy).toBeCloseTo(-34);
    expect(footStep(0.75).dy).toBeCloseTo(0);
  });

  it('pushes off from behind and lands ahead', () => {
    expect(footStep(0).dx).toBeCloseTo(-16);
    expect(footStep(0.5).dx).toBeCloseTo(16);
  });
});

describe('feet', () => {
  it('keeps one foot on the ground while the other is in the air', () => {
    for (const stride of [0.1, 0.3, 0.6, 0.9, 1.2]) {
      const [left, right] = feet(stride);

      expect(Math.min(left.dy, right.dy)).toBeLessThan(0);
      expect(Math.max(left.dy, right.dy)).toBeCloseTo(0);
    }
  });
});

describe('runnerFrame', () => {
  it('runs a little over two strides a second', () => {
    expect(runnerFrame(1, running).pose.stride).toBeCloseTo(RUN_CADENCE);
  });

  it('pumps the arms in opposition', () => {
    for (const seconds of [0, 0.1, 0.23, 0.4]) {
      const { armL = 0, armR = 0 } = runnerFrame(seconds, running).pose;

      expect(armL + armR).toBeCloseTo(88);
    }
  });

  it('clacks the clapper around its running angle', () => {
    const angles = Array.from({ length: 40 }, (_, index) => runnerFrame(index / 40, running).pose.angle ?? 0);

    expect(Math.min(...angles)).toBeGreaterThanOrEqual(-28);
    expect(Math.max(...angles)).toBeLessThanOrEqual(-16);
  });

  it('bobs between the ground and the top of each stride, leaning into the run', () => {
    for (const seconds of [0, 0.05, 0.11, 0.3]) {
      const frame = runnerFrame(seconds, running);

      expect(frame.bob).toBeGreaterThanOrEqual(0);
      expect(frame.bob).toBeLessThanOrEqual(1);
      expect(frame.lean).toBeGreaterThan(0);
    }
  });

  it('stands on the spot, upright, when the motion has to keep still', () => {
    const frame = runnerFrame(0.3, { done: false, still: true });

    expect(frame.pose.stride).toBeUndefined();
    expect(frame.bob).toBe(0);
    expect(frame.lean).toBe(0);
  });

  it('throws its arms up and grins at the finish, still motion or not', () => {
    for (const still of [false, true]) {
      const { pose, lean } = runnerFrame(0.3, { done: true, still });

      expect(pose.stride).toBeUndefined();
      expect(pose.mood).toBe('grin');
      expect(pose.armL).toBeGreaterThan(120);
      expect(lean).toBe(0);
    }
  });
});

describe('springProgress', () => {
  const wobbly = { stiffness: 210, damping: 7, mass: 0.6 };

  it('starts at rest', () => {
    expect(springProgress(0, wobbly)).toBe(0);
    expect(springProgress(-1, wobbly)).toBe(0);
  });

  it('overshoots its target, then settles on it', () => {
    const samples = Array.from({ length: 60 }, (_, index) => springProgress(index / 60, wobbly));

    expect(Math.max(...samples)).toBeGreaterThan(1.2);
    expect(springProgress(2, wobbly)).toBeCloseTo(1, 3);
  });

  it('never overshoots when critically damped', () => {
    const critical = { stiffness: 100, damping: 20, mass: 1 };
    const samples = Array.from({ length: 90 }, (_, index) => springProgress(index / 30, critical));

    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(springProgress(3, critical)).toBeCloseTo(1, 3);
  });
});

describe('cheerFrame', () => {
  it('starts from the logo’s resting clapper', () => {
    expect(cheerFrame(0).pose.angle).toBeCloseTo(REST_ANGLE);
  });

  it('winds the clapper up wider before the slam', () => {
    expect(cheerFrame(SLAM_AT - 0.2).pose.angle).toBeLessThan(REST_ANGLE - 5);
  });

  it('is shut on the slam, as the impact lands and the grin arrives', () => {
    const slam = cheerFrame(SLAM_AT);

    expect(slam.pose.angle).toBe(0);
    expect(slam.pose.mood).toBe('grin');
    expect(cheerFrame(SLAM_AT + 0.05).impact).toBeGreaterThan(0.5);
  });

  it('throws both arms up after the clap', () => {
    const { armL = 0, armR = 0 } = cheerFrame(SLAM_AT + 0.4).pose;

    expect(armL).toBeGreaterThan(120);
    expect(armR).toBe(armL);
  });

  it('settles into a smile, the clapper open again and the arms down', () => {
    const settled = cheerFrame(CHEER_SECONDS);

    expect(settled.pose.angle).toBeCloseTo(REST_ANGLE, 0);
    expect(settled.pose.armL).toBeLessThan(70);
    expect(settled.pose.mood).toBe('smile');
    expect(settled.impact).toBe(0);
  });

  it('holds the settled pose once the cheer is over', () => {
    expect(cheerFrame(CHEER_SECONDS + 10)).toEqual(cheerFrame(CHEER_SECONDS));
  });
});

describe('crossed', () => {
  it('is true only for the step that reaches the moment', () => {
    expect(crossed(0.5, 0.6, 0.55)).toBe(true);
    expect(crossed(0.4, 0.55, 0.55)).toBe(true);
    expect(crossed(0.55, 0.6, 0.55)).toBe(false);
    expect(crossed(0.1, 0.2, 0.55)).toBe(false);
  });

  it('catches a jump straight past the moment', () => {
    expect(crossed(-1, CHEER_SECONDS, SLAM_AT)).toBe(true);
  });
});

describe('reactionFrame', () => {
  it('looks left, then right, then shrugs at the visitor when a page is missing', () => {
    expect(reactionFrame('search', 0.6).pose.lookX).toBeLessThan(-0.5);
    expect(reactionFrame('search', 1.5).pose.lookX).toBeGreaterThan(0.5);

    const shrug = reactionFrame('search', REACTION_SECONDS.search).pose;

    expect(shrug.lookX).toBeCloseTo(0);
    expect(shrug.armL).toBeGreaterThan(85);
    expect(shrug.armR).toBe(shrug.armL);
  });

  it('scratches its head over a request it cannot read, then keeps the hand there', () => {
    const scratch = Array.from({ length: 20 }, (_, index) => reactionFrame('puzzle', index / 20).pose.armL ?? 0);

    expect(Math.min(...scratch)).toBeGreaterThan(140);
    expect(Math.max(...scratch) - Math.min(...scratch)).toBeGreaterThan(4);
    expect(reactionFrame('puzzle', REACTION_SECONDS.puzzle).pose.armL).toBeCloseTo(154);
    expect(reactionFrame('puzzle', 0).tilt).toBeLessThan(0);
  });

  it('slams the clapper shut on a crash and leaves it shut', () => {
    expect(reactionFrame('cut', CUT_SLAM_AT - 0.2).pose.angle).toBeLessThan(REST_ANGLE);
    expect(reactionFrame('cut', CUT_SLAM_AT).pose.angle).toBe(0);
    expect(reactionFrame('cut', CUT_SLAM_AT + 0.05).impact).toBeGreaterThan(0.5);

    const after = reactionFrame('cut', REACTION_SECONDS.cut);

    expect(after.pose.angle).toBe(0);
    expect(after.pose.mood).toBe('wow');
    expect(after.impact).toBe(0);
  });

  it('winks and dozes without moving', () => {
    expect(REACTION_SECONDS.wink).toBe(0);
    expect(reactionFrame('wink', 0).pose.mood).toBe('wink');
    expect(REACTION_SECONDS.doze).toBe(0);
    expect(reactionFrame('doze', 0).pose.mood).toBe('sleepy');
  });

  it('holds its last pose once the reaction is over', () => {
    const reactions: ClappyReaction[] = ['search', 'puzzle', 'cut', 'wink', 'doze'];

    for (const reaction of reactions) {
      const end = REACTION_SECONDS[reaction];

      expect(reactionFrame(reaction, end + 5)).toEqual(reactionFrame(reaction, end));
    }
  });
});
