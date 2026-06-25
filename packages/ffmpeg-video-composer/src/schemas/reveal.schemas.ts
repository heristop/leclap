import { z } from 'zod';

// ── reveal / exit (animated text entrance + exit) ────────────────────────────────
//
// Animated entrance/exit for sugar text. Each is authored as the bare type ("rise") or the full
// object with timing. The reveal preset (editor/presets/text.ts) lowers them to drawtext alpha/x/y
// expressions. Split out of effects.schemas.ts to keep that file under the max-lines budget;
// re-exported from there so importers keep a single entry point.

export const REVEAL_TYPES = ['none', 'fade', 'rise', 'slide-left', 'slide-right'] as const;

export const RevealObjectSchema = z
  .object({
    type: z.enum(REVEAL_TYPES).describe('Entrance style: none, fade, rise (up from below), slide-left, slide-right.'),
    delay: z.number().min(0).optional().describe('Seconds before the entrance starts (default 0.3).'),
    duration: z.number().positive().optional().describe('Seconds the entrance takes (default 0.6).'),
    distance: z.number().positive().optional().describe('Pixels the text travels for rise/slide (default 60).'),
  })
  .strict()
  .describe('Animated entrance for sugar text, with optional timing overrides.');

export const RevealSchema = z
  .union([z.enum(REVEAL_TYPES), RevealObjectSchema])
  .describe('Animated text entrance: a bare type ("rise") or an object with timing overrides.');

// An animated EXIT (fade/slide out). Same styles as a reveal; `after` says when the exit begins
// (seconds from the section start), defaulting so the exit ends at the section's end.
export const ExitObjectSchema = z
  .object({
    type: z.enum(REVEAL_TYPES).describe('Exit style: none, fade, rise (up/out), slide-left, slide-right.'),
    after: z
      .number()
      .min(0)
      .optional()
      .describe('Seconds from the section start when the exit begins (default: timed to end at the section end).'),
    duration: z.number().positive().optional().describe('Seconds the exit takes (default 0.6).'),
    distance: z.number().positive().optional().describe('Pixels travelled for rise/slide exits (default 60).'),
  })
  .strict()
  .describe('Animated exit for sugar text, with optional timing overrides.');

export const ExitSchema = z
  .union([z.enum(REVEAL_TYPES), ExitObjectSchema])
  .describe('Animated text exit: a bare type ("fade") or an object with timing overrides.');
