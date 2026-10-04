// Fits a kinetic block to the unit budget and measures its entrance. Shared by the lowering
// (editor/presets/kinetic.ts) and the time-reference pass, which needs to know when a block has landed
// (`"title.end"`) without drawing it. Pure.

import type { KineticBlock } from '../../schemas/kinetic.schemas';
import { layoutKinetic, type KineticUnit, type Layout } from './layout';
import { resolveKinetic, staggerRanks, type KineticFrame, type ResolvedKinetic } from './resolve';

/** Upper bound of independently animated units per block (each is a drawtext). */
export const MAX_KINETIC_UNITS = 64;
const COARSER: Record<KineticUnit, KineticUnit> = { glyph: 'word', word: 'line', line: 'line' };

/** The block laid out at its unit, stepping up to coarser units until it fits the budget. */
export function layoutWithin(settings: ResolvedKinetic, text: string): { layout: Layout; unit: KineticUnit } | null {
  let unit = settings.unit;

  for (;;) {
    const layout = layoutKinetic({ ...settings, unit, text, y: 0 });

    if (!layout) return null;

    if (layout.pieces.length <= MAX_KINETIC_UNITS || unit === 'line') return { layout, unit };

    unit = COARSER[unit];
  }
}

/**
 * Seconds from the block's first move to its last unit landing: the last stagger rank plus one unit
 * duration (a counter rolls for one duration). 0 when there is nothing to draw.
 */
export function kineticEntranceSpan(block: KineticBlock, frame: KineticFrame, text: string): number {
  const settings = resolveKinetic({ ...block, delay: 0 }, frame);

  if (block.preset === 'counter') return settings.duration;

  const laid = text.trim() ? layoutWithin(settings, text) : null;

  if (!laid) return 0;

  // The last rank does not depend on the seed: a random order is still a permutation.
  const ranks = staggerRanks(laid.layout.pieces, block.order, 0);

  return Math.max(0, ...ranks) * settings.stagger + settings.duration;
}
