import { z } from 'zod';
import { EasingSpecSchema, MotionRoleSchema } from './motion.schemas';
import { ElementIdSchema, timeValue } from './time.schemas';

// ── animated graphics (docs/plans/motion-system-v2.md §4.4) ──────────────────────
//
// Editorial shapes and light hits that animate in on a curve: flash, bars, underline, frame, corners,
// wipe, panel. FFmpeg evaluates drawbox geometry once per filter, so each animated frame is its own box
// behind an `enable` window: frame-exact, deterministic, and on every backend.

const timing = {
  id: ElementIdSchema.optional(),
  at: timeValue(z.number().min(0))
    .optional()
    .describe('When it animates in: seconds from the section start (default 0) or a time reference ("beat:8").'),
  duration: z.number().positive().max(3).optional().describe('Seconds the animation takes (default per type).'),
  ease: EasingSpecSchema.optional().describe('Curve of the animation (default per type, e.g. $expo).'),
  role: MotionRoleSchema.optional(),
  until: timeValue(z.number().min(0))
    .optional()
    .describe('When it disappears: seconds or a time reference ("end - 0.3"); default: holds to the cut.'),
  color: z.string().optional().describe('Colour, "#rrggbb" or "#rrggbb@alpha" (default per type).'),
  above: z.boolean().optional().describe('Draw above text (default: true for flash and wipe, false otherwise).'),
};

const placement = {
  x: z.number().optional().describe('Left edge in px.'),
  y: z.number().optional().describe('Top edge in px.'),
  width: z.number().positive().optional().describe('Width in px.'),
};

export const GraphicSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('flash'),
        ...timing,
        intensity: z.number().min(0).max(1).optional().describe('Peak opacity (default 0.85).'),
      })
      .strict()
      .describe('A full-frame light hit that decays (default white, 0.3 s). Pair with a camera hit.'),
    z
      .object({
        type: z.literal('bars'),
        ...timing,
        aspect: z.number().min(1).max(4).optional().describe('Cinema aspect the bars frame (default 2.39).'),
      })
      .strict()
      .describe('Letterbox bars that slide in from the top and bottom edges.'),
    z
      .object({
        type: z.literal('underline'),
        ...timing,
        ...placement,
        thickness: z.number().positive().max(80).optional().describe('Line thickness in px (default 6).'),
        origin: z.enum(['left', 'center', 'right']).optional().describe('Where the line grows from (default left).'),
      })
      .strict()
      .describe('A rule that draws itself across under a headline.'),
    z
      .object({
        type: z.literal('frame'),
        ...timing,
        inset: z.number().min(0).optional().describe('Distance from the frame edge in px (default 48).'),
        thickness: z.number().positive().max(40).optional().describe('Stroke in px (default 4).'),
      })
      .strict()
      .describe('A rectangle outline that traces itself clockwise.'),
    z
      .object({
        type: z.literal('corners'),
        ...timing,
        inset: z.number().min(0).optional().describe('Distance from the frame edge in px (default 56).'),
        length: z.number().positive().optional().describe('Arm length in px (default 72).'),
        thickness: z.number().positive().max(40).optional().describe('Stroke in px (default 5).'),
      })
      .strict()
      .describe('Four corner brackets that extend from the corners (viewfinder / focus framing).'),
    z
      .object({
        type: z.literal('wipe'),
        ...timing,
        direction: z.enum(['left', 'right', 'up', 'down']).optional().describe('Travel direction (default left).'),
      })
      .strict()
      .describe(
        'A solid colour panel that sweeps across the whole frame: covers, then uncovers (an in-scene transition).'
      ),
    z
      .object({
        type: z.literal('panel'),
        ...timing,
        ...placement,
        height: z.number().positive().optional().describe('Height in px.'),
        from: z
          .enum(['left', 'right', 'top', 'bottom'])
          .optional()
          .describe('Edge the panel grows from (default left).'),
      })
      .strict()
      .describe('A solid block that grows from one edge: a backing plate for text or a colour reveal.'),
  ])
  .meta({ id: 'Graphic' });

export const GraphicsSchema = z
  .array(GraphicSchema)
  .max(24)
  .describe('Animated graphics: flash, bars, underline, frame, corners, wipe, panel.');

export type Graphic = z.infer<typeof GraphicSchema>;
