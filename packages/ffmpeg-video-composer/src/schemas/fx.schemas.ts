import { z } from 'zod';

// ── fx targets (editor/presets/fx-target.ts) ─────────────────────────────────────
//
// Procedural effects live INSIDE the element they decorate: a target names that element, the effect
// derives its geometry from it (so one descriptor adapts to landscape, portrait and square) and its light
// is clipped to the target's shape. Targets resolve at compile time to an even-pixel rectangle.

const FRACTION = /^(iw|ih)\s*\*\s*(\d*\.?\d+)$/;

const DimensionSchema = z
  .union([
    z.number(),
    z.string().regex(FRACTION, 'a number of px, or a fraction of the frame: "iw*0.5" (width) / "ih*0.25" (height)'),
  ])
  .describe('Pixels, or a fraction of the output frame: "iw*0.5" (of the width), "ih*0.25" (of the height).');

export const FxRectTargetSchema = z
  .object({
    x: DimensionSchema.describe('Left edge: px or "iw*f" / "ih*f".'),
    y: DimensionSchema.describe('Top edge: px or "iw*f" / "ih*f".'),
    w: DimensionSchema.describe('Width: px or "iw*f" / "ih*f".'),
    h: DimensionSchema.describe('Height: px or "iw*f" / "ih*f".'),
    radius: z
      .number()
      .min(0)
      .max(2000)
      .optional()
      .describe('Corner radius in px (default 0); the effect is clipped to the rounded shape.'),
  })
  .strict()
  .describe('An explicit rectangle, e.g. the card or the video a light should live on.');

export const FX_TARGET_REF = /^(pane|layer|text):(\d+)$/;

export const FxTargetSchema = z
  .union([
    z.literal('frame'),
    z.string().regex(FX_TARGET_REF, 'use "frame", "pane:<i>", "layer:<i>", "text:<i>" or a {x,y,w,h,radius} rectangle'),
    FxRectTargetSchema,
  ])
  .describe(
    'What the effect lives on; it never draws outside it. "frame": the whole frame (default). "pane:<i>": ' +
      'pane i of the section layout (split screen). "layer:<i>": options.layers[i] of a color_background. ' +
      '"text:<i>": kinetic block i, clipped to its letters. {x, y, w, h, radius}: a rectangle in px or ' +
      'frame fractions ("iw*0.5"), with rounded corners. Snapped inward to even pixels and clamped to the frame.'
  )
  .meta({ id: 'FxTarget' });

export type FxRectTarget = z.infer<typeof FxRectTargetSchema>;
export type FxTarget = z.infer<typeof FxTargetSchema>;
