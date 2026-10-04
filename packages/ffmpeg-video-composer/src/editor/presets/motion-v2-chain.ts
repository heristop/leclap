import type { Filter } from '@/core/types';
import { deriveSeed } from '@/core/determinism/hash';
import { resolveMotionVersion, resolveSeed } from '@/core/determinism/contract';

// D3: under motionVersion 2 every `noise` filter (grain grades, the glitch look, authored grain) gets an
// explicit `all_seed` derived from `global.seed` and the filter's own path. FFmpeg's built-in default
// seed is a constant, so without this every grain layer in a film would show the identical pattern, and
// a new seed could not reshuffle it.

// noise's all_seed is a signed int (-1 = random), so keep derived seeds in 0..INT_MAX.
const INT_MAX = 0x7fffffff;

export function seedNoiseFilters(filters: Filter[], globalSeed: number, sectionName: string): Filter[] {
  return filters.map((filter, index) => {
    if (filter.type !== 'noise' || typeof filter.value !== 'string' || filter.value.includes('all_seed')) {
      return filter;
    }

    const seed = deriveSeed(globalSeed, `sections.${sectionName}.filters[${index}]`) & INT_MAX;

    return { ...filter, value: `${filter.value}:all_seed=${seed}` };
  });
}

interface ChainSource {
  meta?: { motionVersion?: number } | null;
  global?: { seed?: number } | null;
}

/**
 * The section chain under motionVersion 2: a leading CFR `fps` conform, because v2 animates on the frame
 * index (`n/FPS`, core/determinism/contract.ts) and that is only exact once every frame sits on the
 * output grid; and seeded `noise`. Version 1 chains are returned untouched (historical output).
 */
export function conformMotionV2Chain(
  filters: Filter[],
  descriptor: ChainSource,
  fps: number,
  sectionName: string
): Filter[] {
  if (resolveMotionVersion(descriptor) < 2) return filters;

  return [{ type: 'fps', value: fps }, ...seedNoiseFilters(filters, resolveSeed(descriptor), sectionName)];
}
