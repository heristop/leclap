import { z } from 'zod';
import { confetti, glint, ripple } from './fx-celebrate.schemas';

// ── fx primitives: the parameter surface of every procedural effect ─────────────
//
// An fx effect is a PRIMITIVE with parameters, not a canned look: every field that defines how it looks
// (profile, width, angle, path, colour, intensity, timing, repetition, seed) is exposed and validated
// here, and an omitted field gets a default derived from the context (target size, theme accent, motion
// energy, the element's seed), so two templates using the same primitive do not look alike unless they
// ask to. One row per primitive: its own fields (merged with the shared fx fields in fx.schemas.ts) and
// the design intent the motion catalog shows to authors. The lowering lives in editor/presets/fx-<name>.ts.

export interface FxIntent {
  /** What the primitive is, in one line. */
  summary: string;
  /** When it earns its place. */
  useWhen: string;
  /** When to leave it out. */
  avoidWhen: string;
  /** Which parameters make it yours: what to vary and in which direction. */
  vary: string;
  /** What reduced motion (global.motion.energy 0) turns it into. */
  reduced: string;
}

export interface FxDefaults {
  /** Seconds one pass takes at global.motion.energy 1 (scaled by 1/√energy, energy clamped to 0.5–2). */
  duration: number;
  ease: string;
  /** Doctrine ceiling: the peak alpha at intensity 1. */
  ceiling: number;
  /** Default intensity (0..1 of the ceiling). */
  intensity: number;
}

export interface FxPrimitive {
  /** Primitive-specific fields; every one optional, with a context-derived default. */
  params: z.ZodRawShape;
  defaults: FxDefaults;
  intent: FxIntent;
}

const sheen = {
  params: {
    profile: z
      .enum(['specular', 'soft', 'twin'])
      .optional()
      .describe(
        'Light profile across the band: specular (tight gaussian core + a bloom twice as wide, default: glass, ' +
          'metal, screens), soft (one wide gaussian wash: paper, fabric, matte cards), twin (two thin parallel ' +
          'glints: chrome, lenses, techy UI).'
      ),
    width: z
      .number()
      .min(0.02)
      .max(0.6)
      .optional()
      .describe(
        "Band width as a fraction of the target's short side (default ~0.15, varied by target shape and seed). " +
          '0.05–0.1 = a crisp glint, 0.2–0.4 = a broad wash.'
      ),
    tilt: z
      .number()
      .min(-60)
      .max(60)
      .optional()
      .describe(
        'Band angle in degrees off the perpendicular of its travel (default 14–26, from the seed). 0 = square ' +
          'to the path; negative leans the other way.'
      ),
    direction: z
      .enum(['right', 'left', 'down', 'up'])
      .optional()
      .describe(
        'Travel path across the target (default: right on wide targets, down on tall ones). Match the ' +
          "scene's motion or reading direction."
      ),
    bloom: z
      .number()
      .min(0)
      .max(0.6)
      .optional()
      .describe('Share of the peak carried by the soft bloom around a specular core (default 0.25; 0 = bare core).'),
  },
  // Peak alpha 0.32 by default: a glint, never a wash (doctrine: light ≤ 0.35).
  defaults: { duration: 0.75, ease: 'cubic-bezier(0.45, 0, 0.2, 1)', ceiling: 0.35, intensity: 0.32 / 0.35 },
  intent: {
    summary:
      'A specular light band that crosses its target once (or `repeat` times), clipped to the target shape: light on the glass of a card, a screen, a product shot or the letters of a title.',
    useWhen: 'a hero object lands or resolves; a CTA card or price settles; a title locks up',
    avoidWhen: 'over faces or footage with skin (keep intensity ≤ 0.6 there); more than one sheen per beat',
    vary: 'profile and width set the material (crisp glint vs. broad wash); tilt and direction set the light source; colour (e.g. "$color.accent") tints it; duration and ease set the speed (0.6–0.9 s reads as a glint, 1.2 s+ as a slow reflection); repeat + every turn it into a periodic glint.',
    reduced: 'a static 8% highlight that fades in and out on the target',
  },
} satisfies FxPrimitive;

/**
 * Every fx primitive, keyed by `effect`. Adding one: a row here (fields + intent), its lowering module
 * editor/presets/fx-<name>.ts and one line in the registry of editor/presets/fx.ts.
 */
export const FX_PRIMITIVES = { sheen, ripple, glint, confetti } as const satisfies Record<string, FxPrimitive>;

export type FxEffectName = keyof typeof FX_PRIMITIVES;
