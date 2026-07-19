import type { Filter } from '@/core/types';
import type { MotionEffect } from '../../schemas/template.schemas';

// motionToFilters — split out of looks.ts to keep that file under the max-lines budget; re-exported
// from looks.ts so importers (registry.ts, tests) keep a single `@/editor/presets/looks` entry point.

// ---------------------------------------------------------------------------
// motionToFilters
// ---------------------------------------------------------------------------

export type MotionContext = {
  duration: number;
  /** Scale as 'W:H', e.g. '1280:720' (from default.config.ts / videoConfig.scale). */
  scale: string;
  fps: number;
  /**
   * True for real footage (project_video/video). zoompan must then advance one output frame per
   * input frame (`d=1`) so it never time-stretches the clip; stills (undefined/false) synthesize
   * `frames` output frames from the single input frame (`d=frames`). `duration` should be the
   * clip's real (probed) length for video so the zoom/pan curve completes across the footage.
   */
  isVideo?: boolean;
};

/**
 * Parses a 'W:H' scale string into numeric width and height.
 * Falls back to 1280x720 if the string is malformed.
 */
export function parseScale(scale: string): { w: number; h: number } {
  const parts = scale.split(':');
  const w = parseInt(parts[0] ?? '1280', 10);
  const h = parseInt(parts[1] ?? '720', 10);

  return { w: isNaN(w) ? 1280 : w, h: isNaN(h) ? 720 : h };
}

type KenBurnsEffect = Extract<MotionEffect, { type: 'kenburns' }>;
type RotateEffect = Extract<MotionEffect, { type: 'rotate' }>;
type CropEffect = Extract<MotionEffect, { type: 'crop' }>;
type FlipEffect = Extract<MotionEffect, { type: 'flip' }>;
type ShakeEffect = Extract<MotionEffect, { type: 'shake' }>;
type PulseEffect = Extract<MotionEffect, { type: 'pulse' }>;

type KenBurnsExpressions = {
  z: string;
  x: string;
  y: string;
};

/**
 * Builds Ken Burns zoompan filters.
 * Convention: "left" means the camera pans left-to-right across the image
 * (i.e., x offset increases over time), so the viewer sees the image drift left.
 * "right" is the reverse. "up" increases y offset so the viewer sees the image
 * drift upward. "down" is the reverse.
 *
 * Two filters are emitted per kenburns effect:
 * (a) a pre-upscale to 2*W:-2 to reduce zoompan jitter
 * (b) the zoompan filter
 */
function kenburnsToFilters(effect: KenBurnsEffect, ctx: MotionContext): Filter[] {
  const { w, h } = parseScale(ctx.scale);
  const frames = Math.round(ctx.duration * ctx.fps);
  const intensity = effect.intensity ?? 1.15;
  const direction = effect.direction ?? 'in';
  const sizeStr = `${w}x${h}`;

  // Pre-upscale to reduce zoompan jitter while bounding memory usage
  const preUpscale: Filter = { type: 'scale', value: `${w * 2}:-2` };

  const step = parseFloat(((intensity - 1) / frames).toFixed(6));
  // Stills synthesize `frames` output frames from one input frame; video must advance one output
  // per input frame (d=1) or zoompan slow-motions the clip. `frames` still scales the zoom/pan
  // curve (step, on/frames) across the clip's real length in both cases.
  const d = ctx.isVideo ? 1 : frames;
  const baseZoompanSuffix = `:d=${d}:s=${sizeStr}:fps=${ctx.fps}`;
  const centerX = `iw/2-(iw/zoom/2)`;
  const centerY = `ih/2-(ih/zoom/2)`;

  const DIRECTION_EXPRS: Record<string, KenBurnsExpressions> = {
    in: {
      z: `min(zoom+${step},${intensity})`,
      x: centerX,
      y: centerY,
    },
    out: {
      z: `if(eq(on,1),${intensity},max(zoom-${step},1.0))`,
      x: centerX,
      y: centerY,
    },
    left: {
      z: `${intensity}`,
      x: `(iw-iw/zoom)*(on/${frames})`,
      y: centerY,
    },
    right: {
      z: `${intensity}`,
      x: `(iw-iw/zoom)*(1-on/${frames})`,
      y: centerY,
    },
    up: {
      z: `${intensity}`,
      x: centerX,
      // y increases: viewer sees image drift upward
      y: `(ih-ih/zoom)*(on/${frames})`,
    },
    down: {
      z: `${intensity}`,
      x: centerX,
      // y decreases: viewer sees image drift downward
      y: `(ih-ih/zoom)*(1-on/${frames})`,
    },
  };

  const exprs = DIRECTION_EXPRS[direction] ?? DIRECTION_EXPRS.in;

  const zp: Filter = {
    type: 'zoompan',
    value: `z='${exprs.z}':x='${exprs.x}':y='${exprs.y}'${baseZoompanSuffix}`,
  };

  if (ctx.isVideo) {
    // Conform to the target fps BEFORE zoompan so d=1 maps frames 1:1 without retiming the clip:
    // a 25fps source fed straight into a 30fps d=1 zoompan replays its frames 1:1 at 30fps and runs
    // ~20% fast (9.1s → 7.6s). The fps filter resamples to CFR 30 first, preserving real time.
    return [{ type: 'fps', value: `${ctx.fps}` }, preUpscale, zp];
  }

  return [preUpscale, zp];
}

function rotateToFilters(effect: RotateEffect): Filter[] {
  return [{ type: 'rotate', value: `${effect.angle}*PI/180:c=black` }];
}

function cropToFilters(effect: CropEffect): Filter[] {
  const x = effect.x ?? '(iw-ow)/2';
  const y = effect.y ?? '(ih-oh)/2';

  return [{ type: 'crop', value: `${effect.w}:${effect.h}:${x}:${y}` }];
}

function flipToFilters(effect: FlipEffect): Filter[] {
  if (effect.axis === 'horizontal') {
    return [{ type: 'hflip' }];
  }

  return [{ type: 'vflip' }];
}

/**
 * Handheld camera shake: crops a window that wanders sinusoidally (x on sin, y on cos so the two axes
 * don't move in lockstep), then scales back to `ctx.scale`. The trailing scale is load-bearing: crop
 * alone shrinks the frame by `2*amplitude` px on each axis, and every downstream section must land on
 * the same output geometry for concat/xfade to line up — this is the invariant covered by the
 * "geometry-uniformity" test in looks.test.ts.
 */
function shakeToFilters(effect: ShakeEffect, ctx: MotionContext): Filter[] {
  const amplitude = effect.intensity ?? 6;
  const frequency = effect.frequency ?? 2;
  const cropWindow = `iw-${2 * amplitude}:ih-${2 * amplitude}`;
  const jitterX = `${amplitude}+${amplitude}*sin(t*${frequency}*2*PI)`;
  // 1.7x the x frequency keeps the two axes out of phase so the jitter reads as an irregular wobble
  // rather than the frame tracing a perfect diagonal ellipse.
  const jitterY = `${amplitude}+${amplitude}*cos(t*${frequency}*1.7*PI)`;

  return [
    { type: 'crop', value: `${cropWindow}:${jitterX}:${jitterY}` },
    { type: 'scale', value: ctx.scale },
  ];
}

/**
 * Rhythmic zoom pulse: a zoompan whose zoom factor oscillates around 1 at `frequency` Hz, centred on
 * the frame (reusing kenburnsToFilters's centre expressions). Mirrors kenburnsToFilters's
 * pre-upscale-then-zoompan shape and its isVideo handling (fps-conform + d=1 for real footage so the
 * clip isn't time-stretched; d=frames for stills). Unlike shake, zoompan's own `s=` output-size param
 * already restores `ctx.scale`, so no separate trailing scale filter is needed here.
 */
function pulseToFilters(effect: PulseEffect, ctx: MotionContext): Filter[] {
  const { w, h } = parseScale(ctx.scale);
  const frames = Math.round(ctx.duration * ctx.fps);
  const intensity = effect.intensity ?? 1.08;
  const frequency = effect.frequency ?? 1;
  const sizeStr = `${w}x${h}`;

  const preUpscale: Filter = { type: 'scale', value: `${w * 2}:-2` };
  const d = ctx.isVideo ? 1 : frames;
  const amplitude = (intensity - 1).toFixed(3);
  const z = `1+${amplitude}*0.5*(1+sin(2*PI*${frequency}*on/${ctx.fps}))`;
  const centerX = `iw/2-(iw/zoom/2)`;
  const centerY = `ih/2-(ih/zoom/2)`;

  const zp: Filter = {
    type: 'zoompan',
    value: `z='${z}':x='${centerX}':y='${centerY}':d=${d}:s=${sizeStr}:fps=${ctx.fps}`,
  };

  if (ctx.isVideo) {
    // See kenburnsToFilters: conform fps BEFORE zoompan so d=1 maps frames 1:1 without retiming the clip.
    return [{ type: 'fps', value: `${ctx.fps}` }, preUpscale, zp];
  }

  return [preUpscale, zp];
}

const MOTION_HANDLERS: Record<string, (effect: MotionEffect, ctx: MotionContext) => Filter[]> = {
  kenburns: (effect, ctx) => kenburnsToFilters(effect as KenBurnsEffect, ctx),
  rotate: (effect) => rotateToFilters(effect as RotateEffect),
  crop: (effect) => cropToFilters(effect as CropEffect),
  flip: (effect) => flipToFilters(effect as FlipEffect),
  shake: (effect, ctx) => shakeToFilters(effect as ShakeEffect, ctx),
  pulse: (effect, ctx) => pulseToFilters(effect as PulseEffect, ctx),
};

/**
 * Translates an array of MotionEffect descriptors into an array of Filter objects.
 * Multiple effects are concatenated in array order.
 * Returns [] for undefined or empty motion array.
 */
export function motionToFilters(motion: MotionEffect[] | undefined, ctx: MotionContext): Filter[] {
  if (!motion || motion.length === 0) {
    return [];
  }

  const filters: Filter[] = [];

  for (const effect of motion) {
    filters.push(...MOTION_HANDLERS[effect.type](effect, ctx));
  }

  return filters;
}
