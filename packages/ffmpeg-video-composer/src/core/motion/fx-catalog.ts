// The fx vocabulary as the motion catalog presents it: primitives with open parameters and design intent,
// not a menu of finished looks. Derived from schemas/fx-primitives.schemas.ts, so a new primitive shows up
// here with its fields and notes as soon as its row exists.

import type { z } from 'zod';
import {
  FX_PRIMITIVES,
  FxTargetSchema,
  fxSharedFields,
  type FxDefaults,
  type FxIntent,
} from '../../schemas/fx.schemas';
import { LIBRARY_ANIMATION_SAMPLES, LIBRARY_SAMPLE_NOTE, type LibrarySample } from './library-samples';

export interface FxPrimitiveEntry extends FxIntent {
  /** Primitive-specific fields → what each does (range and default included). */
  params: Record<string, string>;
  defaults: FxDefaults;
}

export interface FxCatalog {
  description: string;
  rules: string[];
  targets: string;
  /** Fields every primitive takes. */
  shared: Record<string, string>;
  primitives: Record<string, FxPrimitiveEntry>;
}

const RULES = [
  'Compose, do not pick: set the parameters that define the look (profile, width, tilt, direction, colour, ' +
    'intensity, duration/ease, repeat) for THIS template; an untuned fx only gets context defaults.',
  'Anchor every effect to the element it decorates with `target` (a card rect with its radius, a pane, a layer, ' +
    'a kinetic block). Light never spills outside its target.',
  'Light adds, it never greys: peaks stay under the ceiling (light ≤ 0.35 alpha); ≤ 0.6 intensity over skin.',
  'One hero effect per beat, at most two layered; land it on the beat the target resolves (`at: "card.end"`).',
  'Tie colour to the theme ("$color.accent", "$color.fg") and speed to the motion energy and tokens ($smooth, $expo).',
  'Vary `seed` to re-roll context defaults; the same descriptor always renders the same pixels.',
];

function describe(shape: z.ZodRawShape): Record<string, string> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, (schema as z.ZodType).description ?? ''])
  );
}

/** The creative kit's library animations, labelled as samples and mapped to the primitives that replace them. */
export interface SamplesCatalog {
  note: string;
  animations: LibrarySample[];
}

export function samplesCatalog(): SamplesCatalog {
  return { note: LIBRARY_SAMPLE_NOTE, animations: LIBRARY_ANIMATION_SAMPLES };
}

export function fxCatalog(): FxCatalog {
  return {
    description:
      'section.graphics[] entries { type: "fx", effect, ...parameters }: procedural light primitives lowered at ' +
      'output resolution, clipped to a target, deterministic from global.seed.',
    rules: RULES,
    targets: FxTargetSchema.description ?? '',
    shared: fxSharedFields(),
    primitives: Object.fromEntries(
      Object.entries(FX_PRIMITIVES).map(([name, row]) => [
        name,
        { ...row.intent, params: describe(row.params), defaults: row.defaults },
      ])
    ),
  };
}
