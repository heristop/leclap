import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP } from './cinema';

// How Clappy (clappy.tsx) acts: the classic principles made reusable. `useHop` gives anticipation
// (crouch), stretch on take-off, an arc through the air and squash on landing; `useClap` winds up,
// slams, and lets the stick wobble to rest (follow-through); `useLook` makes the pupils lead and the
// head follow a few frames later (overlapping action); `ClapBody` applies squash/stretch from the feet.

/** Natural blinking: a quick close/open every ~2.3s, offset by `phase` frames. */
export const useBlink = (phase = 0): number => {
  const frame = useCurrentFrame();
  const cycle = (frame + phase) % 70;

  return interpolate(cycle, [0, 3, 6], [0, 1, 0], CLAMP);
};

/**
 * The clap: wind up wider, SLAM shut on `slamFrame`, hold a beat, then spring open — overshooting and
 * wobbling to rest (follow-through). Returns the stick angle and a 0..1 impact pulse for squash/shake.
 */
export const useClap = (slamFrame: number, rest = -24): { angle: number; impact: number } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const windUp = interpolate(frame, [slamFrame - 14, slamFrame - 4], [rest, rest - 14], {
    ...CLAMP,
    easing: (x) => 1 - (1 - x) ** 3,
  });
  const shut = interpolate(frame, [slamFrame - 4, slamFrame], [rest - 14, 0], { ...CLAMP, easing: (x) => x ** 3 });
  const reopen = spring({ frame: frame - slamFrame - 3, fps, config: { damping: 7, stiffness: 210, mass: 0.6 } });
  const impact = interpolate(frame - slamFrame, [0, 2, 14], [0, 1, 0], CLAMP);

  if (frame < slamFrame - 4) return { angle: windUp, impact };

  if (frame < slamFrame + 3) return { angle: shut, impact };

  return { angle: interpolate(reopen, [0, 1], [0, rest]), impact };
};

export interface HopState {
  /** Vertical offset in px (negative = up). */
  y: number;
  /** Horizontal progress 0..1 along the hop. */
  progress: number;
  /** Non-uniform scale: squash (sx>1, sy<1) on crouch/landing, stretch (sx<1, sy>1) in flight. */
  sx: number;
  sy: number;
  /** True while airborne. */
  airborne: boolean;
}

/**
 * A hop from `start` (frame): 6-frame crouch (anticipation), stretch on take-off, a parabolic arc of
 * `height` px over `air` frames, then a squash on landing that springs back (follow-through).
 */
export const useHop = (start: number, height: number, air = 16): HopState => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - start;
  const crouch = interpolate(t, [0, 6], [0, 1], CLAMP);
  const flight = interpolate(t, [6, 6 + air], [0, 1], CLAMP);
  const land = spring({ frame: t - 6 - air, fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });

  if (t < 0) return { y: 0, progress: 0, sx: 1, sy: 1, airborne: false };

  if (t < 6) return { y: 0, progress: 0, sx: 1 + crouch * 0.14, sy: 1 - crouch * 0.16, airborne: false };

  if (t < 6 + air) {
    const arc = 4 * flight * (1 - flight);
    const stretch = Math.max(0, 1 - flight * 3) * 0.18 + Math.max(0, flight * 3 - 2) * 0.1;

    return { y: -arc * height, progress: flight, sx: 1 - stretch, sy: 1 + stretch, airborne: true };
  }

  const squash = interpolate(land, [0, 0.35, 1], [0.24, -0.06, 0]);

  return { y: 0, progress: 1, sx: 1 + squash, sy: 1 - squash, airborne: false };
};

/**
 * Overlapping action for a look: the pupils snap to the target first, the head turn follows a few
 * frames behind. `keys` is a list of [frame, lookX] targets.
 */
export const useLook = (keys: readonly (readonly [number, number])[]): { eyes: number; head: number } => {
  const frame = useCurrentFrame();
  const frames = keys.map(([f]) => f);
  const values = keys.map(([, v]) => v);

  if (keys.length < 2) return { eyes: values[0] ?? 0, head: 0 };

  const eyes = interpolate(frame, frames, values, CLAMP);
  const head = interpolate(frame - 5, frames, values, CLAMP);

  return { eyes, head };
};

/** Squash/stretch + arc wrapper: anchors transforms at the feet so squash reads as weight. */
export const ClapBody = ({
  children,
  x = 0,
  y = 0,
  sx = 1,
  sy = 1,
  rotate = 0,
  style,
}: {
  children: ReactNode;
  x?: number;
  y?: number;
  sx?: number;
  sy?: number;
  rotate?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${sx}, ${sy})`,
      transformOrigin: '50% 92%',
      ...style,
    }}
  >
    {children}
  </div>
);
