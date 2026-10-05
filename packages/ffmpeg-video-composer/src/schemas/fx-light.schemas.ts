import { z } from 'zod';

// ── fx light primitives that live AROUND or BESIDE their target: `leak` and `edge-glow` ──────────
//
// Rows of FX_PRIMITIVES (fx-primitives.schemas.ts holds the contract). Every look parameter is open and
// optional; an omitted one is derived from the target, the theme and the element's seed by the lowering
// (editor/presets/fx-leak.ts, fx-edge-glow.ts), so two templates never get the same leak or glow by default.

/** "#rrggbb" (after theme resolution) or a "$color.<name>" theme token; an @alpha suffix is ignored. */
export const FxColorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|\$color\.[a-zA-Z]+)(@[0-9.]+)?$/, 'a "#rrggbb" colour or a "$color.<name>" theme token');

/** The `$smooth` curve, spelled out (defaults are applied after token resolution). */
export const SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';

const LEAK_EDGES = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

export const LEAK = {
  params: {
    edge: z
      .enum(LEAK_EDGES)
      .optional()
      .describe(
        'Where the off-frame source sits (default from the seed: a side or a top corner, top corners on tall ' +
          'targets). The light pours in from there and never reaches the far side.'
      ),
    size: z
      .number()
      .min(0.2)
      .max(1.5)
      .optional()
      .describe(
        "Lobe radius as a fraction of the target's long side (default 0.3–0.42 from the seed). 0.25 = a tight " +
          'flare at the edge, 1+ = a wash over half the frame.'
      ),
    stretch: z
      .number()
      .min(0.5)
      .max(3)
      .optional()
      .describe('Lobe elongation along its edge (default 1–1.3): 1 = round, 2+ = a long streak hugging the edge.'),
    drift: z
      .number()
      .min(-0.3)
      .max(0.3)
      .optional()
      .describe(
        "Travel along the edge over one pass, as a fraction of the edge's length; the sign sets the " +
          'direction (default ±0.06–0.10 from the seed). 0 = a still leak.'
      ),
    secondary: FxColorSchema.optional().describe(
      'Colour of the second lobe: "#rrggbb" or a theme token (default rose #FF7A88; the first lobe is `color`, ' +
        'default amber #FFB36B, both nudged toward the theme accent).'
    ),
    balance: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Strength of the second lobe relative to the first (default 0.55–0.8). 0 = a single lobe.'),
    spread: z
      .number()
      .min(0)
      .max(1.5)
      .optional()
      .describe('Offset of the second lobe along the edge, in lobe radii (default 0.5–0.9).'),
    shadows: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'How much the shadows are kept clean (default 1: the light lifts the mid-tones and never the blacks; ' +
          '0 = a wash into the shadows too). Surfaces brighter than the light itself are always left alone.'
      ),
    rise: z
      .number()
      .min(0.05)
      .max(0.6)
      .optional()
      .describe('Share of the life spent fading in (default 0.3); ease-in, so it blooms rather than switches on.'),
    fall: z
      .number()
      .min(0.1)
      .max(0.8)
      .optional()
      .describe('Share of the life spent fading out (default 0.5): a leak leaves more slowly than it arrives.'),
  },
  // Peak 0.22 at the brightest point by default (doctrine: leaks ≤ 0.25).
  defaults: { duration: 2.6, ease: SMOOTH, ceiling: 0.25, intensity: 0.88 },
  intent: {
    summary:
      'A warm light leak: two soft radial lobes from an off-frame source at one edge, drifting slowly along it, rising and fading like film exposure. It lifts the mid-tones, never the blacks, never greys a bright surface, and has no edge anywhere.',
    useWhen: 'a beat change or an entrance on footage or photos; a warm, analogue transition accent',
    avoidWhen: 'over text-heavy cards or UI screenshots; several leaks in a row (one per scene change at most)',
    vary: 'edge and drift set where the light comes from and where it goes; size and stretch set its reach; color/secondary/balance set the hue (amber+rose, gold, teal, the brand accent); rise/fall and duration set the exposure; intensity ≤ 1 keeps it under 0.25.',
    reduced: 'a still, dimmer leak that fades in and out without drifting',
  },
};

export const EDGE_GLOW = {
  params: {
    line: z.number().min(0).max(1).optional().describe('Opacity of the inner hairline (default 0.55; 0 = glow only).'),
    lineWidth: z
      .number()
      .min(0.5)
      .max(8)
      .optional()
      .describe('Hairline width in px at 1080p, scaled with the frame (default 1.5).'),
    spread: z
      .number()
      .min(2)
      .max(48)
      .optional()
      .describe('Bloom radius (gaussian σ) in px at 1080p, scaled with the frame (default 8–12 from the seed).'),
    glow: FxColorSchema.optional().describe(
      'Bloom colour: "#rrggbb" or a theme token (default: the light colour pushed toward the theme accent). ' +
        'The hairline stays near-white.'
    ),
    breathe: z
      .number()
      .min(0)
      .max(0.25)
      .optional()
      .describe('Opacity swing of the bloom, ± share (default 0.06; 0 = steady).'),
    period: z.number().min(1.5).max(12).optional().describe('Seconds per breath (default 3.6–4.8 from the seed).'),
  },
  // Bloom peak 0.18 by default (intensity 0.18 / 0.35); the hairline has its own `line` opacity.
  defaults: { duration: 4, ease: SMOOTH, ceiling: 0.35, intensity: 0.18 / 0.35 },
  intent: {
    summary:
      "A glow around a card or video rect: a crisp inner hairline plus a soft bloom outside the target's (rounded) shape only, breathing gently.",
    useWhen: 'a name card, a CTA or a product card that should read as lit or active; a focused pane',
    avoidWhen: 'on the full frame (use leak or bloom); on more than one card at once',
    vary: 'spread and intensity set how far it radiates; glow (e.g. "$color.accent") sets the tint; line and lineWidth set the hairline; breathe and period set the pulse (0 for a still glow).',
    reduced: 'the same glow, still (no breathing)',
  },
};
