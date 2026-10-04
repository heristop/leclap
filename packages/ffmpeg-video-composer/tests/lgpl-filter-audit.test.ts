import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { lookToFilters, gradeToFilters } from '@/editor/presets/looks';
import { LOOK_PRESETS } from '@/schemas/effects.schemas';
import {
  ENGINE_EMITTED_FILTERS,
  FILTER_COMPAT,
  applyFilterCompat,
  type EngineCapabilities,
} from '@/editor/utils/filter-compat';
import { parseEnabledFilters, parseEnabledLibraries } from '../scripts/capability-sources';
import { DEVICE_FILTERS, DEVICE_LIBRARIES } from '@/editor/utils/device-filters.generated';
import { KineticBlockSchema } from '@/schemas/kinetic.schemas';
import { kineticToFilters } from '@/editor/presets/kinetic';
import { layoutToFilters } from '@/editor/presets/layout';
import type { Filter } from '@/core/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const commonSh = fs.readFileSync(path.resolve(here, '../../../scripts/ffmpeg/common.sh'), 'utf8');

// deviceFilters: null here is deliberate — this audit probes rewrite rules only (e.g. eq→lutyuv);
// the drop-absent-on-device rule is out of scope (it would trivially "cover" every filter by
// dropping it, defeating the point of asserting engine-emitted filters land on a real device filter).
const lgplCaps: EngineCapabilities = {
  gpl: false,
  lut3d: true,
  colorkey: true,
  textShaping: false,
  deviceFilters: null,
};

function isDeviceSafe(filterType: string, enabled: Set<string>): boolean {
  if (enabled.has(filterType)) {
    return true;
  }

  // Not in the build list: acceptable only if a compat rule rewrites it to an enabled filter (or
  // deliberately drops it) under LGPL capabilities.
  const resolved = applyFilterCompat({ type: filterType, value: 'x=1' }, lgplCaps);

  if (resolved === null) {
    return true;
  }

  return resolved.type !== filterType && enabled.has(resolved.type);
}

describe('LGPL device filter audit', () => {
  let enabled: Set<string>;

  beforeAll(() => {
    enabled = parseEnabledFilters(commonSh);
  });

  it('every look preset lowers to device-safe filters', () => {
    for (const look of LOOK_PRESETS) {
      for (const filter of lookToFilters(look)) {
        expect(isDeviceSafe(filter.type, enabled), `look "${look}" emits "${filter.type}"`).toBe(true);
      }
    }
  });

  it('a full grade lowers to device-safe filters', () => {
    const fullGrade = {
      brightness: 0.02,
      contrast: 1.1,
      saturation: 1.1,
      gamma: 0.98,
      hue: 10,
      blur: 0.5,
      curvesPreset: 'vintage',
      colorBalance: { shadows: { r: 0.05 } },
    };

    for (const filter of gradeToFilters(fullGrade as never)) {
      expect(isDeviceSafe(filter.type, enabled), `grade emits "${filter.type}"`).toBe(true);
    }
  });

  it('every filter the engine declares it can emit is device-safe', () => {
    for (const filterType of ENGINE_EMITTED_FILTERS) {
      expect(isDeviceSafe(filterType, enabled), `engine emits "${filterType}"`).toBe(true);
    }
  });

  it('compat rules rewrite to filters that exist on device', () => {
    for (const rule of FILTER_COMPAT) {
      const probe = rule.remap({ type: 'eq', value: 'contrast=1.1' });

      if (probe === null) {
        continue;
      }

      expect(enabled.has(probe.type), `rule "${rule.key}" remaps to "${probe.type}"`).toBe(true);
    }
  });

  it('device-filters.generated.ts matches common.sh', () => {
    expect(new Set(DEVICE_FILTERS)).toEqual(parseEnabledFilters(commonSh));
    expect(new Set(DEVICE_LIBRARIES)).toEqual(parseEnabledLibraries(commonSh));
  });

  it('links libfribidi on device (drawtext text_shaping) alongside harfbuzz/freetype', () => {
    expect(DEVICE_LIBRARIES.has('fribidi')).toBe(true);
    expect(DEVICE_LIBRARIES.has('harfbuzz')).toBe(true);
  });

  it('mask and layout sub-graphs lower to device-safe filters only', () => {
    const block = KineticBlockSchema.parse({
      text: { en: 'Shine' },
      preset: 'cascade',
      effect: { shadow: true },
      fill: { gradient: { stops: ['#f00', '#0f0', '#00f'] }, sweep: { every: 2 } },
    });
    const env = { width: 640, height: 360, fps: 25, duration: 2, prefix: 'k_', color: (c: string) => c };
    const fill = kineticToFilters(block, {
      width: 640,
      height: 360,
      fps: 25,
      duration: 2,
      seed: 1,
      energy: 1,
      text: 'Shine',
      fill: env,
    });
    const layouts = [
      { type: 'split', sources: ['a.png', 'b.mp4', '#ff0000'], divider: {} },
      { type: 'before-after', before: 'a.png', after: 'b.mp4', wipe: { at: 0.5, direction: 'up' }, divider: {} },
    ].flatMap((layout) =>
      layoutToFilters(layout as never, {
        ...env,
        self: 'x',
        sections: [],
        input: (key: string) => `input:${key}`,
      })
    );
    const types = (filters: Filter[]): string[] =>
      filters.flatMap((f) => (f.graph ? f.graph.flatMap((chain) => types(chain.filters)) : [f.type]));

    for (const type of types([...fill, ...layouts])) {
      expect(enabled.has(type), `mask/layout emits "${type}"`).toBe(true);
      expect(ENGINE_EMITTED_FILTERS as readonly string[], type).toContain(type);
    }
  });
});
