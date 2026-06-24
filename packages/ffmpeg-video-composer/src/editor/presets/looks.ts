import type { Filter } from '@/core/types';
import type { Grade, MotionEffect, BackgroundLayer } from '../../schemas/template.schemas';

// ---------------------------------------------------------------------------
// lookToFilters
// ---------------------------------------------------------------------------

type LookEntry = Filter[];

// Defensive copies are returned at call-time so downstream managers that mutate
// Filter objects in place cannot corrupt the table. The table must stay
// primitives-only (strings/numbers) so that a shallow spread copy is sufficient.
const LOOK_TABLE: Record<string, LookEntry> = {
  cinematic: [
    { type: 'eq', value: 'contrast=1.12:saturation=1.18:gamma=0.95' },
    { type: 'colorbalance', value: 'bs=0.06:rs=-0.03' },
  ],
  warm: [{ type: 'colorbalance', value: 'rs=0.08:rm=0.05:bs=-0.06' }],
  cool: [{ type: 'colorbalance', value: 'bs=0.08:bm=0.04:rs=-0.05' }],
  vintage: [
    { type: 'curves', value: 'preset=vintage' },
    { type: 'eq', value: 'saturation=0.85' },
  ],
  noir: [
    { type: 'hue', value: 's=0' },
    { type: 'eq', value: 'contrast=1.25:brightness=0.02' },
  ],
  vivid: [{ type: 'eq', value: 'saturation=1.35:contrast=1.08' }],
  dreamy: [
    { type: 'gblur', value: 'sigma=0.8' },
    { type: 'eq', value: 'brightness=0.04:saturation=1.1' },
  ],
  // LUT-backed cinema looks. The value is the LUT *name*; the FormatterManager stages its generated
  // `.cube` and rewrites it to a `lut3d=file='…'`. A single 3D LUT is a bigger, cleaner grade than the
  // eq/curves stacks above and runs on every backend (lut3d is a standard LGPL filter).
  'teal-orange': [{ type: 'lut3d', value: 'teal-orange' }],
  'warm-film': [{ type: 'lut3d', value: 'warm-film' }],
  'mono-film': [{ type: 'lut3d', value: 'mono' }],
  'noir-film': [{ type: 'lut3d', value: 'noir' }],
  'vivid-pop': [{ type: 'lut3d', value: 'vivid' }],
};

/**
 * Translates a named look preset into an array of Filter objects.
 * Returns [] for undefined or unknown look (Zod rejects unknown values upstream).
 */
export function lookToFilters(look?: string): Filter[] {
  if (!look) {
    return [];
  }

  return (LOOK_TABLE[look] ?? []).map((filter) => ({ ...filter }));
}

// ---------------------------------------------------------------------------
// gradeToFilters
// ---------------------------------------------------------------------------

type EqField = 'brightness' | 'contrast' | 'saturation' | 'gamma';

const EQ_FIELDS: EqField[] = ['brightness', 'contrast', 'saturation', 'gamma'];

type RangeKey = 'shadows' | 'midtones' | 'highlights';
type ChannelKey = 'r' | 'g' | 'b';

const CB_RANGES: [RangeKey, string][] = [
  ['shadows', 's'],
  ['midtones', 'm'],
  ['highlights', 'h'],
];

const CB_CHANNELS: [ChannelKey, string][] = [
  ['r', 'r'],
  ['g', 'g'],
  ['b', 'b'],
];

function buildEqParts(grade: Grade): string[] {
  return EQ_FIELDS.flatMap((field) => {
    const val = grade[field];

    return val === undefined ? [] : [`${field}=${val}`];
  });
}

/**
 * Translate an `eq` filter value (`contrast`/`brightness`/`saturation`/`gamma`) into an equivalent
 * LGPL `lutyuv` expression. The `eq` filter is GPL-only, so the on-device LGPL engine can't run it;
 * lutyuv replicates eq's per-channel LUT math — luma = pow((y-0.5)·contrast+0.5+brightness, 1/gamma),
 * chroma = (c-128)·saturation+128 — within ~50 dB PSNR of eq. Unknown keys fall back to identity.
 */
export function eqValueToLutyuv(eqValue: string): string {
  const params: Record<string, number> = { contrast: 1, brightness: 0, saturation: 1, gamma: 1 };

  for (const part of eqValue.split(':')) {
    const [key, raw] = part.split('=');
    const value = Number(raw);

    if (key in params && Number.isFinite(value)) {
      params[key] = value;
    }
  }

  const luma = `clip(pow(clip((val/255-0.5)*${params.contrast}+0.5+${params.brightness},0,1),1/${params.gamma})*255,0,255)`;
  const chroma = `clip((val-128)*${params.saturation}+128,0,255)`;

  return `y='${luma}':u='${chroma}':v='${chroma}'`;
}

function buildCbParts(grade: Grade): string[] {
  const { colorBalance } = grade;

  if (!colorBalance) {
    return [];
  }

  const parts: string[] = [];

  for (const [range, rangeSuffix] of CB_RANGES) {
    const rangeObj = colorBalance[range];

    for (const [channel, channelPrefix] of CB_CHANNELS) {
      const value = rangeObj?.[channel];

      if (value !== undefined) {
        parts.push(`${channelPrefix}${rangeSuffix}=${value}`);
      }
    }
  }

  return parts;
}

/**
 * Translates a Grade descriptor object into an ordered array of Filter objects.
 * Emission order: eq, hue, colorbalance, gblur, curves.
 * Returns [] for undefined or empty grade.
 */
export function gradeToFilters(grade?: Grade): Filter[] {
  if (!grade) {
    return [];
  }

  const filters: Filter[] = [];
  const eqParts = buildEqParts(grade);

  if (eqParts.length > 0) {
    filters.push({ type: 'eq', value: eqParts.join(':') });
  }

  if (grade.hue !== undefined) {
    filters.push({ type: 'hue', value: `h=${grade.hue}` });
  }

  const cbParts = buildCbParts(grade);

  if (cbParts.length > 0) {
    filters.push({ type: 'colorbalance', value: cbParts.join(':') });
  }

  if (grade.blur !== undefined && grade.blur > 0) {
    filters.push({ type: 'gblur', value: `sigma=${grade.blur}` });
  }

  if (grade.curvesPreset) {
    filters.push({ type: 'curves', value: `preset=${grade.curvesPreset}` });
  }

  return filters;
}

// ---------------------------------------------------------------------------
// motionToFilters
// ---------------------------------------------------------------------------

type MotionContext = {
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
function parseScale(scale: string): { w: number; h: number } {
  const parts = scale.split(':');
  const w = parseInt(parts[0] ?? '1280', 10);
  const h = parseInt(parts[1] ?? '720', 10);

  return { w: isNaN(w) ? 1280 : w, h: isNaN(h) ? 720 : h };
}

type KenBurnsEffect = Extract<MotionEffect, { type: 'kenburns' }>;
type RotateEffect = Extract<MotionEffect, { type: 'rotate' }>;
type CropEffect = Extract<MotionEffect, { type: 'crop' }>;
type FlipEffect = Extract<MotionEffect, { type: 'flip' }>;

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

const MOTION_HANDLERS: Record<string, (effect: MotionEffect, ctx: MotionContext) => Filter[]> = {
  kenburns: (effect, ctx) => kenburnsToFilters(effect as KenBurnsEffect, ctx),
  rotate: (effect) => rotateToFilters(effect as RotateEffect),
  crop: (effect) => cropToFilters(effect as CropEffect),
  flip: (effect) => flipToFilters(effect as FlipEffect),
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

// ---------------------------------------------------------------------------
// layersToFilters
// ---------------------------------------------------------------------------

/**
 * Translates an array of BackgroundLayer descriptors into drawbox Filter objects.
 *
 * NOTE: Gradient layers need a `gradients` lavfi source input and an overlay map,
 * which cannot be expressed as a plain section filter — they are intentionally
 * skipped here and compiled by the input/maps pipeline.
 *
 * Layers without a color AND without a gradient are also skipped (nothing to draw).
 */
export function layersToFilters(layers: BackgroundLayer[] | undefined): Filter[] {
  if (!layers || layers.length === 0) {
    return [];
  }

  const filters: Filter[] = [];

  for (const layer of layers) {
    if (layer.gradient) {
      // Gradient layers are compiled by the input/maps pipeline, not as section filters.
      continue;
    }

    if (!layer.color) {
      continue;
    }

    const opacity = layer.opacity ?? 1;
    const colorWithOpacity = `${layer.color}@${opacity}`;

    filters.push({
      type: 'drawbox',
      values: {
        x: layer.x ?? 0,
        y: layer.y ?? 0,
        w: layer.w ?? 'iw',
        h: layer.h ?? 'ih',
        c: colorWithOpacity,
        t: 'fill',
      },
    });
  }

  return filters;
}
