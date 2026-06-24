import type { Filter, ProjectConfig } from '@/core/types';
import { usesLgplEngine } from '../core/encoding';
import { eqValueToLutyuv } from './presets/looks';

/**
 * What the active FFmpeg build can do. The on-device engine is a `--disable-gpl` LGPL build, so
 * GPL-only filters (`eq`, `vignette`, …) are absent; the server/web/Node default is GPL-capable.
 * Compatibility rules below key off these flags instead of branching on the codec ad hoc.
 */
export type EngineCapabilities = {
  /** GPL filters available (eq, vignette, geq, …). False on the on-device LGPL engine. */
  gpl: boolean;
};

export function engineCapabilities(config: ProjectConfig): EngineCapabilities {
  return { gpl: !usesLgplEngine(config) };
}

/**
 * A platform compatibility rule: when `match` holds for a filter under the current engine
 * capabilities, the filter is replaced by `remap`'s result (or dropped when it returns null).
 * Adding support for another unavailable filter is one entry here.
 */
export type FilterCompatRule = {
  key: string;
  match: (filter: Filter, caps: EngineCapabilities) => boolean;
  remap: (filter: Filter) => Filter | null;
};

export const FILTER_COMPAT: FilterCompatRule[] = [
  {
    // The GPL `eq` filter is absent on the LGPL engine — rewrite it to an equivalent lutyuv LUT.
    key: 'eq-to-lutyuv',
    match: (filter, caps) => filter.type === 'eq' && Boolean(filter.value) && !caps.gpl,
    remap: (filter) => ({ ...filter, type: 'lutyuv', value: eqValueToLutyuv(String(filter.value)) }),
  },
];

/**
 * Applies every matching compatibility rule to a filter, in registry order. Returns the (possibly
 * rewritten) filter, or null when a rule drops it entirely (the filter is unavailable and has no
 * equivalent on this engine).
 */
export function applyFilterCompat(filter: Filter, caps: EngineCapabilities): Filter | null {
  let resolved: Filter | null = filter;

  for (const rule of FILTER_COMPAT) {
    if (resolved && rule.match(resolved, caps)) {
      resolved = rule.remap(resolved);
    }
  }

  return resolved;
}
