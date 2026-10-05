import { z } from 'zod';

// ── fx primitives "bokeh" and "dust": ambient particles (rows of FX_PRIMITIVES, fx-primitives.schemas.ts) ──
//
// Lowered by editor/presets/fx-particles.ts. Both are ambient textures: capped at 0.12 alpha, drifting
// slowly, and absent under reduced motion (global.motion.energy 0).

const drift = z
  .number()
  .min(-180)
  .max(360)
  .optional()
  .describe(
    'Drift heading in degrees, screen convention: 0 = right, 90 = down, -90 (or 270) = up. Default from the seed ' +
      '(bokeh: rising within ±70° of up; dust: settling or rising within ±35° of vertical).'
  );

const clear = z
  .number()
  .min(0)
  .max(0.8)
  .optional()
  .describe(
    "Half-size of the empty zone kept at the target's centre, as a share of the target (default 0.3 for bokeh, " +
      '0.2 for dust): where titles sit. 0 = particles anywhere.'
  );

export const bokeh = {
  params: {
    count: z
      .number()
      .int()
      .min(2)
      .max(16)
      .optional()
      .describe('Number of out-of-focus discs (default 6–10 from the seed). Fewer, larger discs read calmer.'),
    size: z
      .number()
      .min(0.02)
      .max(0.3)
      .optional()
      .describe(
        "Radius of the nearest discs as a share of the target's short side (default ~0.1–0.15). The middle and " +
          'far depth tiers are 0.6× and 0.35× that.'
      ),
    softness: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Edge roll-off as a share of the radius (default 0.25–0.45): 0 = crisp lens discs, 1 = soft glowing blobs.'
      ),
    drift,
    speed: z
      .number()
      .min(0)
      .max(0.2)
      .optional()
      .describe(
        'Drift of the nearest tier in target short sides per second (default 0.035, scaled by motion energy); far tiers move slower (parallax).'
      ),
    depth: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Parallax spread between depth tiers (default 0.5): 0 = all tiers drift together, 1 = far tiers almost still.'
      ),
    clear,
  },
  // Ambient light: ≤ 0.12 alpha at the brightest disc (plan acceptance), 0.09 by default.
  defaults: { duration: 6, ease: 'linear', ceiling: 0.12, intensity: 0.75 },
  intent: {
    summary:
      'Out-of-focus light discs drifting slowly in three depth tiers (near discs larger, brighter and faster), clipped to the target: depth and warmth behind a title card or an intro.',
    useWhen: 'a calm title or name card needs depth; an intro or outro card over a flat or dark background',
    avoidWhen: 'busy footage, product shots, data or UI screens; more than one ambient texture per section',
    vary: 'count, size and softness set the lens (a few large soft discs vs. many crisp ones); drift and speed set the air; depth sets the parallax; colour (e.g. "$color.accent") tints the light; seed re-rolls the layout. Set duration to the section length.',
    reduced: 'absent (ambient motion is dropped)',
  },
};

export const dust = {
  params: {
    count: z
      .number()
      .int()
      .min(4)
      .max(40)
      .optional()
      .describe('Motes visible at once on average (default 16–24 from the seed).'),
    size: z
      .number()
      .min(0.5)
      .max(4)
      .optional()
      .describe(
        'Mote diameter in px at 720p, scaled to the frame (default 2.5: about 2 and 3 px motes; smaller ones vanish under video compression at the 0.12 ceiling).'
      ),
    drift,
    speed: z
      .number()
      .min(0)
      .max(0.1)
      .optional()
      .describe('Drift in target short sides per second (default 0.012, scaled by motion energy, ±50% per mote).'),
    flicker: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'How often motes catch and lose the light (default 0.5): 0 = every mote stays for the whole effect, 1 = short ' +
          'lives (about a third of the effect) fading in and out.'
      ),
    clear,
  },
  // Ambient texture: ≤ 0.12 alpha per mote (plan acceptance); motes are tiny, so they sit at the ceiling by default.
  defaults: { duration: 6, ease: 'linear', ceiling: 0.12, intensity: 1 },
  intent: {
    summary:
      'Fine motes of dust drifting and catching the light (1–2 px, seeded positions and lives), clipped to the target: air in a still photo or a quiet interview intro.',
    useWhen: 'a still photo, a backdrop or a slow interview intro needs air and texture',
    avoidWhen: 'fast cuts, bright flat UI screens; together with bokeh or grain in the same section',
    vary: 'count and size set the density; drift and speed set the air (settling vs. rising warm air); flicker sets how often motes catch the light; colour tints them; seed re-rolls the field. Set duration to the section length.',
    reduced: 'absent (ambient motion is dropped)',
  },
};
