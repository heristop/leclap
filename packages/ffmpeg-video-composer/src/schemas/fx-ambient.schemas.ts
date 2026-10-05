import { z } from 'zod';
import { SMOOTH } from './fx-light.schemas';

// ── fx ambient primitives: `bloom`, `vignette-breathe`, `grain` ─────────────────────────────────
//
// Rows of FX_PRIMITIVES (fx-primitives.schemas.ts holds the contract). Ambient textures sit under the
// doctrine's 0.12 ceiling, last as long as `duration` (or `until`) with a soft ramp at both ends, and are
// absent under reduced motion. Lowerings: editor/presets/fx-bloom.ts, fx-vignette.ts, fx-grain.ts.

export const BLOOM = {
  params: {
    threshold: z
      .number()
      .min(0.3)
      .max(0.98)
      .optional()
      .describe(
        'Luma (0..1 of the video range) above which highlights halate (default 0.68–0.78 from the seed). Lower = ' +
          'more of the picture glows; 0.9 = only speculars and skies.'
      ),
    knee: z
      .number()
      .min(0.02)
      .max(0.4)
      .optional()
      .describe('Softness of the threshold, in luma (default 0.12): small = only clipped highlights, large = gradual.'),
    radius: z
      .number()
      .min(0.002)
      .max(0.06)
      .optional()
      .describe(
        "Halation spread (gaussian σ) as a fraction of the target's short side (default ~0.011, i.e. 12 px at " +
          '1080p, from the seed). 0.03+ = a dreamy haze.'
      ),
    ramp: z
      .number()
      .min(0.13)
      .max(2)
      .optional()
      .describe('Seconds of fade-in and fade-out at both ends of the life (default 0.5).'),
  },
  defaults: { duration: 6, ease: SMOOTH, ceiling: 0.12, intensity: 0.85 },
  intent: {
    summary:
      'Highlight halation: the brightest parts of the picture bleed a soft, warm glow into their surroundings, as film does. Built from the frame itself, so it follows the footage.',
    useWhen: 'bright skies, windows, product speculars; a filmic, warm finish on photos or footage',
    avoidWhen: 'on flat UI cards or text-only sections (nothing to bloom); stacked with leak and vignette at once',
    vary: 'threshold and knee choose what glows; radius sets how far; color (warm white, gold, the accent) tints the halo; intensity ≤ 1 keeps it ≤ 0.12.',
    reduced: 'absent',
  },
};

export const VIGNETTE_BREATHE = {
  params: {
    angle: z
      .number()
      .min(0.15)
      .max(1.2)
      .optional()
      .describe('Lens angle in radians: how far in the falloff reaches (default 0.55–0.7 from the seed; PI/5 ≈ 0.63).'),
    swing: z
      .number()
      .min(0)
      .max(0.15)
      .optional()
      .describe('Breathing amplitude of the angle in radians (default 0.04; 0 = a still vignette).'),
    period: z
      .number()
      .min(2)
      .max(16)
      .optional()
      .describe('Seconds per breath (default 5.4–6.6 from the seed). Keep ≥ 4 s: it should never be noticed.'),
    focus: z
      .object({
        x: z.number().min(0).max(1).describe('0..1 across the target (default ~0.5).'),
        y: z.number().min(0).max(1).describe('0..1 down the target (default ~0.45).'),
      })
      .strict()
      .optional()
      .describe("Centre of attention as fractions of the target (e.g. the speaker's face); the falloff rings it."),
  },
  defaults: { duration: 6, ease: SMOOTH, ceiling: 0.12, intensity: 1 },
  intent: {
    summary:
      'A slow, barely-there vignette that breathes: the edges of the target darken a little and the falloff drifts in and out, steering the eye to a focus point.',
    useWhen: 'interviews, portraits, photo backdrops: a quiet focus on the subject',
    avoidWhen: 'bright, graphic cards where dark corners read as dirt; together with another darkening grade',
    vary: 'angle sets the reach; focus moves the centre onto the subject; swing and period set the breath; color (default near-black) can warm it; intensity ≤ 1 keeps corners ≤ 12 % darker.',
    reduced: 'absent',
  },
};

export const GRAIN = {
  params: {
    size: z
      .number()
      .min(1)
      .max(4)
      .optional()
      .describe('Grain size in px at 1080p, scaled with the frame (default 1: fine; 2–3 = 16 mm-like).'),
    animated: z
      .boolean()
      .optional()
      .describe('A new grain pattern every frame, like film (default true); false = a still texture.'),
    ramp: z
      .number()
      .min(0.13)
      .max(2)
      .optional()
      .describe('Seconds of fade-in and fade-out at both ends of the life (default 0.3).'),
  },
  defaults: { duration: 6, ease: SMOOTH, ceiling: 0.12, intensity: 0.85 },
  intent: {
    summary:
      'Fine, seeded, luma-only film grain under a low ceiling (noise strength 12 at intensity 1): binds mixed footage and flat cards into one texture.',
    useWhen: 'mixed sources (phone footage, screenshots, renders) cut together; a filmic finish',
    avoidWhen: 'crisp UI demos and text-heavy cards; on top of grade.grain',
    vary: 'size sets fine vs. coarse; intensity ≤ 1 sets the amount (below ~0.7 a standard encode smooths it away on flat areas); animated false gives a paper-like still texture; seed re-rolls the pattern.',
    reduced: 'absent',
  },
};
