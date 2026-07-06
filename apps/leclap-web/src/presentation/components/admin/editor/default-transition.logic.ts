// Pure boundary-vs-default transition resolution for the transition picker chip and dialog.
// Mirrors the engine's rule (TemplateDirector: `section.transition ?? global.transition`): a
// boundary without its own transition renders with the template default, and an explicit
// `{ type: 'cut' }` override beats a non-cut default.
import type { SectionTransition, DefaultTransition } from '../templateEditorModel';

// The picker dialog's sentinel tile id for "clear the override, use the template default".
export const DEFAULT_TILE = 'default';

const FALLBACK_DURATION = 0.5;

export interface EffectiveBoundary {
  type: string;
  duration: number;
  /** True when the boundary renders with the template default (no override, non-cut default). */
  fromDefault: boolean;
}

/** The transition a boundary actually renders with: its override when set, else the template default. */
export function effectiveBoundary(
  transition: SectionTransition | undefined,
  fallback: DefaultTransition | undefined
): EffectiveBoundary {
  const fallbackDuration = fallback?.duration ?? FALLBACK_DURATION;

  if (transition) {
    return { type: transition.type, duration: transition.duration ?? fallbackDuration, fromDefault: false };
  }

  if (hasNonCutDefault(fallback)) return { type: fallback.type, duration: fallback.duration, fromDefault: true };

  return { type: 'cut', duration: fallbackDuration, fromDefault: false };
}

/** True when the template declares a real (non-cut) default transition. */
export function hasNonCutDefault(fallback: DefaultTransition | undefined): fallback is DefaultTransition {
  return Boolean(fallback && fallback.type !== 'cut');
}

/**
 * The override to store when a tile is picked in the boundary dialog. Picking the default tile
 * clears the override; picking "cut" clears it too UNLESS a non-cut default exists — then only an
 * explicit `{ type: 'cut' }` override keeps the boundary a hard cut in the engine.
 */
export function boundaryPick(
  type: string,
  duration: number,
  fallback: DefaultTransition | undefined
): SectionTransition | undefined {
  if (type === DEFAULT_TILE) return undefined;

  if (type === 'cut') return hasNonCutDefault(fallback) ? { type: 'cut', duration } : undefined;

  return { type, duration };
}
