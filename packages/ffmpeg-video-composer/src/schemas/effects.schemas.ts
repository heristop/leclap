import { z } from 'zod';

// ── xfade / audio constants ────────────────────────────────────────────────────

export const XFADE_TRANSITIONS = [
  'fade',
  'fadeblack',
  'fadewhite',
  'fadegrays',
  'distance',
  'dissolve',
  'pixelize',
  'radial',
  'hblur',
  'wipeleft',
  'wiperight',
  'wipeup',
  'wipedown',
  'wipetl',
  'wipetr',
  'wipebl',
  'wipebr',
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  'smoothleft',
  'smoothright',
  'smoothup',
  'smoothdown',
  'circlecrop',
  'rectcrop',
  'circleclose',
  'circleopen',
  'horzclose',
  'horzopen',
  'vertclose',
  'vertopen',
  'diagbl',
  'diagbr',
  'diagtl',
  'diagtr',
  'hlslice',
  'hrslice',
  'vuslice',
  'vdslice',
  'hlwind',
  'hrwind',
  'vuwind',
  'vdwind',
  'coverleft',
  'coverright',
  'coverup',
  'coverdown',
  'revealleft',
  'revealright',
  'revealup',
  'revealdown',
  'squeezeh',
  'squeezev',
  'zoomin',
] as const;

export const AFADE_CURVES = [
  'tri',
  'qsin',
  'hsin',
  'esin',
  'log',
  'ipar',
  'qua',
  'cub',
  'squ',
  'cbr',
  'par',
  'exp',
  'iqsin',
  'ihsin',
  'dese',
  'desi',
  'losi',
  'sinc',
  'isinc',
  'nofade',
] as const;

export const LOOK_PRESETS = ['cinematic', 'warm', 'cool', 'vintage', 'noir', 'vivid', 'dreamy'] as const;

// ── transition ─────────────────────────────────────────────────────────────────

/**
 * Effective transition duration fallback (seconds) when neither the section nor the global
 * transition declares one. Shared by the validator, the director's timeline math and the
 * music windows — they MUST agree or validation passes templates that render desynced.
 */
export const DEFAULT_TRANSITION_DURATION = 0.3;

export const TransitionSchema = z
  .object({
    type: z
      .union([z.enum(XFADE_TRANSITIONS), z.literal('cut')])
      .describe('xfade transition name between this section and the next, or "cut" for a hard cut.'),
    duration: z
      .number()
      .positive()
      .max(5)
      .optional()
      .describe('Transition length in seconds (default: the global transition duration, then 0.3).'),
  })
  .describe('Transition applied at the end of the section before the next one begins.');

// ── audio ──────────────────────────────────────────────────────────────────────

export const AudioFadeSchema = z
  .object({
    duration: z.number().positive().describe('Fade length in seconds.'),
    curve: z.enum(AFADE_CURVES).optional().describe('FFmpeg afade curve shape (default: tri).'),
  })
  .describe('Audio fade-in or fade-out applied to the section audio.');

export const DuckingSchema = z
  .object({
    threshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Audio level (0..1) below which music ducking activates (default 0.05).'),
    ratio: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe('Compression ratio applied when ducking is active, 1..20 (default 8).'),
    attack: z.number().positive().optional().describe('Ducking attack time in milliseconds (default 20).'),
    release: z.number().positive().optional().describe('Ducking release time in milliseconds (default 400).'),
  })
  .describe('Fine-grained ducking parameters; used when global.audio.ducking is an object instead of a boolean.');

export const GlobalAudioSchema = z
  .object({
    sourceVolume: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Volume of the recorded/source audio in the final mix, 0..1 (default 1).'),
    musicVolume: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Volume of the background music track in the final mix, 0..1 (default 0.5).'),
    normalize: z
      .enum(['loudnorm', 'dynaudnorm'])
      .optional()
      .describe('FFmpeg audio normalisation filter to apply to the final mix (default: none).'),
    ducking: z
      .union([z.boolean(), DuckingSchema])
      .optional()
      .describe('Enable music ducking when source audio is present; true uses defaults, object allows fine-tuning.'),
  })
  .describe('Global audio mix settings applied across the entire composition.');

// ── grade / look ───────────────────────────────────────────────────────────────

const ChannelAdjustSchema = z
  .object({
    r: z.number().min(-1).max(1).optional().describe('Red channel adjustment, -1..1.'),
    g: z.number().min(-1).max(1).optional().describe('Green channel adjustment, -1..1.'),
    b: z.number().min(-1).max(1).optional().describe('Blue channel adjustment, -1..1.'),
  })
  .describe('Per-channel RGB adjustment for a tonal range.');

export const GradeSchema = z
  .object({
    brightness: z.number().min(-1).max(1).optional().describe('Brightness offset, -1..1 (default 0).'),
    contrast: z.number().min(0).max(2).optional().describe('Contrast multiplier, 0..2 (default 1).'),
    saturation: z.number().min(0).max(3).optional().describe('Saturation multiplier, 0..3 (default 1).'),
    gamma: z.number().min(0.1).max(3).optional().describe('Gamma correction exponent, 0.1..3 (default 1).'),
    hue: z.number().min(-180).max(180).optional().describe('Hue rotation in degrees, -180..180 (default 0).'),
    colorBalance: z
      .object({
        shadows: ChannelAdjustSchema.optional().describe('RGB adjustment applied to shadow tones.'),
        midtones: ChannelAdjustSchema.optional().describe('RGB adjustment applied to midtone tones.'),
        highlights: ChannelAdjustSchema.optional().describe('RGB adjustment applied to highlight tones.'),
      })
      .optional()
      .describe('Per-range colour balance correction.'),
    blur: z.number().min(0).max(20).optional().describe('Gaussian blur radius in pixels, 0..20 (default 0).'),
    curvesPreset: z.string().optional().describe('Named curves preset key applied on top of other grade settings.'),
  })
  .describe('Colour-grade settings applied to the section video via FFmpeg eq/curves filters.');

// ── motion effects ─────────────────────────────────────────────────────────────

export const MotionEffectSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('kenburns').describe('Slow zoom-and-pan (Ken Burns) effect on the section video.'),
      direction: z
        .enum(['in', 'out', 'left', 'right', 'up', 'down'])
        .optional()
        .describe('Direction of the Ken Burns pan or zoom (default: in).'),
      intensity: z
        .number()
        .min(1.01)
        .max(2)
        .optional()
        .describe('Zoom scale factor at the end of the effect, 1.01..2 (default 1.15).'),
    }),
    z.object({
      type: z.literal('rotate').describe('Rotates the video frame by a fixed angle.'),
      angle: z.number().describe('Rotation angle in degrees; positive values rotate clockwise.'),
    }),
    z.object({
      type: z.literal('crop').describe('Crops the video frame to the specified rectangle.'),
      w: z.union([z.number(), z.string()]).describe('Crop width in pixels or as an FFmpeg expression.'),
      h: z.union([z.number(), z.string()]).describe('Crop height in pixels or as an FFmpeg expression.'),
      x: z
        .union([z.number(), z.string()])
        .optional()
        .describe('Crop x offset in pixels or FFmpeg expression (default (iw-ow)/2).'),
      y: z
        .union([z.number(), z.string()])
        .optional()
        .describe('Crop y offset in pixels or FFmpeg expression (default (ih-oh)/2).'),
    }),
    z.object({
      type: z.literal('flip').describe('Flips the video frame along the specified axis.'),
      axis: z
        .enum(['horizontal', 'vertical'])
        .describe('Axis of the flip: "horizontal" mirrors left-right, "vertical" mirrors top-bottom.'),
    }),
  ])
  .describe('Motion or geometric effect applied to the section video.');

// ── background layer ───────────────────────────────────────────────────────────

export const BackgroundLayerSchema = z
  .object({
    color: z
      .string()
      .optional()
      .describe('Solid fill colour as a CSS hex string or FFmpeg colour name (e.g. "#FF0000").'),
    opacity: z.number().min(0).max(1).optional().describe('Layer opacity, 0..1 (default 1).'),
    x: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Horizontal offset of the layer in output pixels or FFmpeg expression (default 0).'),
    y: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Vertical offset of the layer in output pixels or FFmpeg expression (default 0).'),
    w: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Layer width in output pixels or FFmpeg expression (default: full output width).'),
    h: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Layer height in output pixels or FFmpeg expression (default: full output height).'),
    gradient: z
      .object({
        from: z.string().describe('Start colour of the gradient as a CSS hex string or FFmpeg colour name.'),
        to: z.string().describe('End colour of the gradient as a CSS hex string or FFmpeg colour name.'),
        direction: z
          .enum(['horizontal', 'vertical', 'diagonal'])
          .optional()
          .describe('Direction of the gradient sweep (default: vertical).'),
      })
      .optional()
      .describe('Linear gradient drawn across the layer; overrides the solid color field.'),
  })
  .describe('A single composited background layer drawn onto the color_background section.');

// ── framing guide ──────────────────────────────────────────────────────────────

export const FramingGuideSchema = z
  .object({
    type: z
      .literal('silhouette')
      .describe('Visual style of the framing guide overlay; only "silhouette" is supported.'),
    position: z
      .enum(['left', 'center', 'right'])
      .describe('Horizontal position of the silhouette within the recording viewfinder.'),
    opacity: z.number().min(0).max(1).optional().describe('Opacity of the framing guide overlay, 0..1 (default 0.45).'),
    style: z
      .enum(['bust', 'outline'])
      .optional()
      .describe('Silhouette rendering style: a filled "bust" (default) or a stroked "outline".'),
  })
  .describe('Camera framing guide shown in the recording UI; never rendered into the video.');
