import type { Filter, ProjectConfig } from '@/core/types';
import { usesLgplEngine } from '../../core/encoding';
import { eqValueToLutyuv } from '../presets/looks';
import { DEVICE_FILTERS } from './device-filters.generated';

/**
 * What the active FFmpeg build can do. The on-device engine is a `--disable-gpl` LGPL build, so
 * GPL-only filters (`eq`, `boxblur`, …) are absent; the server/web/Node default is GPL-capable.
 * Compatibility rules below key off these flags instead of branching on the codec ad hoc.
 */
export type EngineCapabilities = {
  /** GPL filters available (eq, boxblur, …). False on the on-device LGPL engine. */
  gpl: boolean;
  /** `lut3d` colour-LUT filter available (a standard LGPL filter; present on every normal build). */
  lut3d: boolean;
  /** `colorkey` chroma-key filter available (standard LGPL filter). */
  colorkey: boolean;
  /** drawtext `text_shaping` (HarfBuzz) available. Off by default — the WASM 6.x core may lack HarfBuzz. */
  textShaping: boolean;
  /** The curated on-device allowlist (generated from common.sh), or null on full GPL/WASM builds
   * where every filter the engine can emit is present. */
  deviceFilters: ReadonlySet<string> | null;
};

// lut3d/colorkey are standard default-enabled filters present on every backend (host GPL, on-device
// LGPL, the 6.x WASM core), so they're advertised as available everywhere; the web e2e confirms the
// WASM core and these flags can be flipped if a filter ever turns out absent (the FILTER_COMPAT rules
// below then drop the effect with a warning rather than aborting the render). text_shaping needs
// HarfBuzz, which the host build and the WASM 6.x core do not reliably bundle, so it stays off — the
// shadow/outline typography below covers legibility on every backend without it.
export function engineCapabilities(config: ProjectConfig): EngineCapabilities {
  return {
    gpl: !usesLgplEngine(config),
    lut3d: true,
    colorkey: true,
    textShaping: false,
    deviceFilters: usesLgplEngine(config) ? DEVICE_FILTERS : null,
  };
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
  {
    // Any filter still absent from the device allowlist after rewrites has no LGPL equivalent:
    // drop it (FilterManager degrades to the no-op `null` filter with a warning) instead of letting
    // the render die on-device with "No such filter".
    key: 'drop-absent-on-device',
    match: (filter, caps) => caps.deviceFilters !== null && !caps.deviceFilters.has(filter.type),
    remap: () => null,
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

/**
 * Every filter name the engine itself can write into a command, beyond the section's authored
 * filters: sugar lowering (looks/grade/motion/captions/text blocks), the map/overlay graphs,
 * scaling, colour metadata and the assembly/audio passes. The LGPL audit test
 * (tests/lgpl-filter-audit.test.ts) cross-checks this inventory against the on-device build's
 * --enable-filter list; extend it whenever a preset or manager starts emitting a new filter.
 */
export const ENGINE_EMITTED_FILTERS = [
  // scaling / framing (SegmentBuilder.prependScaleFilters, input-sources.ts scale/pad chains, layersToFilters)
  'scale',
  'crop',
  'pad',
  'setsar',
  'drawbox',
  // text & reveals (captions.ts, text-blocks.ts, text-blocks-helpers.ts, FilterManager fade shortcuts,
  // input-sources.ts overlay entrance)
  'drawtext',
  'fade',
  // drop-path no-op (FilterManager.addFilter): a compat rule with no device equivalent degrades to
  // this rather than emitting a filter the engine will die on.
  'null',
  // looks / grade (looks.ts LOOK_TABLE + gradeToFilters, post-compat): `eq` is GPL-only and gets
  // rewritten to `lutyuv` under the LGPL engine (see FILTER_COMPAT below)
  'eq',
  'lutyuv',
  'hue',
  'colorbalance',
  'gblur',
  'noise',
  'curves',
  'lut3d',
  // stylized looks (Phase 4 LOOK_TABLE rows: duotone/sketch/glitch)
  'rgbashift',
  'edgedetect',
  // motion (MOTION_HANDLERS in looks.ts) + gradient/animation overlay opacity fade
  'zoompan',
  'rotate',
  'hflip',
  'vflip',
  'fps',
  'colorchannelmixer',
  // maps / overlays / chroma key (MapManager), gradient lavfi source (input-sources.ts), speed
  // (FormatterManager's setpts, authored via section.filters)
  'overlay',
  'split',
  'colorkey',
  'gradients',
  'setpts',
  // colour metadata (core/encoding.ts buildColorMetadataFilter, appended as every segment's final node)
  'setparams',
  // assembly & audio (transition-graph.ts, MusicComposer, audio-fade.ts): atempo is FormatterManager's
  // audio counterpart to setpts (authored via section.filters); asplit/sidechaincompress/amix drive the
  // ducking mix; loudnorm/dynaudnorm the normalize pass; afftdn the noise-reduction pass
  'xfade',
  'acrossfade',
  'format',
  'color',
  'atrim',
  'asetpts',
  'atempo',
  'afade',
  'volume',
  'aformat',
  'amix',
  'asplit',
  'sidechaincompress',
  'afftdn',
  'loudnorm',
  'dynaudnorm',
  'anullsrc',
  'aevalsrc',
] as const;
