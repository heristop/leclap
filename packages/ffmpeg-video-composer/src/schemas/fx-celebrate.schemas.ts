import { z } from 'zod';

// ── fx primitives that mark a moment: ripple (a tap or a pulse), glint (star twinkles, orbiting specs)
// and confetti (a ballistic burst). Rows of FX_PRIMITIVES (fx-primitives.schemas.ts); lowered by
// editor/presets/fx-ripple.ts, fx-glint.ts and fx-confetti.ts. Every field is optional: an omitted one is
// derived from the target, the theme, global.motion.energy and the element's seed. Each row is checked
// against FxPrimitive where FX_PRIMITIVES lists it (no import back: that would be a cycle).

const PointSchema = z
  .object({
    x: z.number().min(-0.5).max(1.5).describe('Across the target: 0 = left edge, 1 = right edge.'),
    y: z.number().min(-0.5).max(1.5).describe('Down the target: 0 = top edge, 1 = bottom edge.'),
  })
  .strict();

function origin(what: string, fallback: string) {
  return PointSchema.optional().describe(`${what}, as fractions of the target ({x, y}; default ${fallback}).`);
}

export const ripple = {
  params: {
    variant: z
      .enum(['ring', 'tap'])
      .optional()
      .describe(
        'ring (default): anti-aliased rings expanding from the origin and fading out (a pulse, a radar, a ' +
          '"look here"). tap: a filled dot pressed in and released, then one ring (a UI tap on a button).'
      ),
    origin: origin('Ring centre', 'the target centre'),
    radius: z
      .number()
      .min(0.1)
      .max(3)
      .optional()
      .describe(
        "The rings' final radius as a share of the target's short side (default 0.9–1.2 from the seed, so the ring clears its target; a tap " +
          'on a small button: 0.9–1.4 so the ring clears it).'
      ),
    rings: z.number().int().min(1).max(3).optional().describe('Rings per pass (default 2 for ring, 1 for tap).'),
    stagger: z
      .number()
      .min(0)
      .max(0.6)
      .optional()
      .describe('Seconds between ring starts (default 0.18). The pass duration covers every ring.'),
    start: z
      .number()
      .min(0.1)
      .max(0.9)
      .optional()
      .describe('Ring size when it appears, as a share of its final size (default 0.375: 0.6 → 1.6).'),
    stroke: z
      .number()
      .min(1)
      .max(16)
      .optional()
      .describe('Ring stroke in px at 1080p, at full size (default 4; scaled to the output frame).'),
    halo: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .describe('Gaussian halo around the stroke, σ in px at 1080p (default 6; 0 = a bare line).'),
    dot: z
      .number()
      .min(0.05)
      .max(0.8)
      .optional()
      .describe("tap: the pressed dot's radius as a share of the final ring radius (default 0.28)."),
    press: z
      .number()
      .min(0)
      .max(0.3)
      .optional()
      .describe('tap: how far the dot sinks on press, as a share of its size (default 0.09: 0.9 → 0.82 → 1).'),
  },
  defaults: { duration: 0.88, ease: 'cubic-bezier(0.16, 1, 0.3, 1)', ceiling: 0.85, intensity: 1 },
  intent: {
    summary:
      'Expanding anti-aliased rings (or a pressed dot plus a ring) from a point of the target: a tap, a pulse, a "look here".',
    useWhen: 'a UI tap in a product demo; a call to action or a hotspot that needs one beat of attention',
    avoidWhen: 'on every element of a section; over faces; more than two passes in a row (it reads as an alarm)',
    vary: 'variant sets the gesture (ring = pulse, tap = touch); origin puts it on the exact control; radius, start and stroke set its scale and weight; rings + stagger set its rhythm; colour defaults to the theme accent.',
    reduced: 'one still ring at its middle size that fades in and out (an opacity pulse, no growth)',
  },
};

export const glint = {
  params: {
    path: z
      .enum(['scatter', 'corners', 'orbit'])
      .optional()
      .describe(
        'Where the light sits: scatter (default: seeded points on the target, biased to its upper half and ' +
          'corners, like specular highlights), corners (just inside its corners), orbit (lights travelling ' +
          "around the target's edge with a short trail: a spec orbit for product shots)."
      ),
    points: z
      .array(PointSchema)
      .min(1)
      .max(6)
      .optional()
      .describe('Exact star positions as target fractions; overrides path and count (scatter/corners only).'),
    count: z
      .number()
      .int()
      .min(1)
      .max(6)
      .optional()
      .describe('Stars (default 3–5 from the seed, fewer on small targets) or orbiting lights (default 2).'),
    size: z
      .number()
      .min(8)
      .max(96)
      .optional()
      .describe(
        'Star span in px at 1080p (default 36–52 per star from the seed, 34 for orbit lights; scaled to the output frame).'
      ),
    stagger: z
      .number()
      .min(0)
      .max(0.4)
      .optional()
      .describe('Seconds between star twinkles (default 0.12). The pass duration covers every star.'),
    spin: z
      .number()
      .min(-90)
      .max(90)
      .optional()
      .describe('Degrees each star turns while it twinkles (default 15; 0 = no turn).'),
    trail: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('orbit: strength of the trail behind each light (default 0.4; 0 = none).'),
    speed: z.number().min(0.2).max(3).optional().describe('orbit: revolutions per second (default 0.9).'),
  },
  // Point sources: the peak is high (a star must read at 1080p) but each covers < 0.1 % of the frame.
  defaults: { duration: 0.9, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)', ceiling: 0.9, intensity: 0.85 },
  intent: {
    summary:
      'Four-point star glints that twinkle once on a target (scale up, turn, vanish), or small lights orbiting it: the sparkle of something new or polished.',
    useWhen: 'a product, a logo or a price lands; a "new" badge; jewellery, glass, chrome',
    avoidWhen: 'over text you need read; on footage with busy highlights; together with confetti in one beat',
    vary: 'path sets the character (scatter = sparkle, corners = a framed gem, orbit = a spec orbit); count, size and points set the density; stagger and duration set the rhythm; spin and the twinkle ease set the snap; colour tints the light.',
    reduced: 'the stars appear at rest at half size and fade in and out (no scale, turn or travel)',
  },
};

export const confetti = {
  params: {
    count: z
      .number()
      .int()
      .min(4)
      .max(36)
      .optional()
      .describe('Pieces in the burst (default 24–32, from the seed and energy). Repeated passes share 36.'),
    origin: origin('Where the burst starts', 'the target centre, {x: 0.5, y: 0.5}'),
    angle: z
      .number()
      .min(-180)
      .max(180)
      .optional()
      .describe('Burst direction in degrees: -90 = up (default), 0 = right, 90 = down, ±180 = left.'),
    spread: z
      .number()
      .min(0)
      .max(360)
      .optional()
      .describe('Cone the pieces leave in, degrees around angle (default 70–110 from the seed; 360 = all around).'),
    speed: z
      .number()
      .min(0.2)
      .max(4)
      .optional()
      .describe('Launch speed in frame heights per second (default 1.5; each piece varies ±25 %).'),
    gravity: z
      .number()
      .min(0)
      .max(8)
      .optional()
      .describe('Downward pull in frame heights per s² (default 1.6; 0 = floating).'),
    drag: z
      .number()
      .min(0.1)
      .max(8)
      .optional()
      .describe('Air drag per second (default 3.2): higher = pieces stall and drift down slowly, like paper.'),
    sway: z
      .number()
      .min(0)
      .max(0.1)
      .optional()
      .describe('Side-to-side flutter while falling, in frame widths (default 0.012).'),
    spin: z
      .number()
      .min(0)
      .max(4)
      .optional()
      .describe('Maximum tumble in turns per second (default 1.4; each piece gets its own rate and sense).'),
    size: z
      .number()
      .min(4)
      .max(64)
      .optional()
      .describe("A piece's long side in px at 1080p (default 22; scaled to the output frame)."),
    discs: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Share of round pieces; the rest are 2:1 strips (default 0.2).'),
    colors: z
      .array(z.string())
      .min(1)
      .max(5)
      .optional()
      .describe(
        'Palette, 1–5 colours ("#rrggbb", names or "$color.*" tokens). Default: the theme accent, accent2, ' +
          'brand and a neutral (fg).'
      ),
    depth: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Depth tiers: 1 (default) gives pieces at 0.6 / 0.8 / 1.0 size with slight alpha; 0 = all equal.'),
    fade: z.number().min(0.1).max(2).optional().describe('Seconds faded out at the end of the burst (default 0.5).'),
  },
  defaults: { duration: 2.2, ease: 'linear', ceiling: 1, intensity: 1 },
  intent: {
    summary:
      'A ballistic burst of tumbling paper pieces in the theme colours: launched from a point, slowed by drag, pulled down by gravity, swaying as they fall.',
    useWhen: 'a real celebration: a launch, a milestone, a win, a sign-up count; once per video',
    avoidWhen: 'serious, corporate or editorial tones; behind text that must be read; more than one burst per video',
    vary: 'origin, angle and spread aim it (a cannon from a corner, a fountain from below, a pop from the centre); speed, gravity and drag set the physics (snappy vs. floaty); count, size and discs set the density; colors restyle it (theme tokens by default).',
    reduced: 'a few pieces appear at rest around the origin and fade in and out (no flight, no tumble)',
  },
};
