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
import { parseEnabledFilters } from '../scripts/capability-sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const commonSh = fs.readFileSync(path.resolve(here, '../../../scripts/ffmpeg/common.sh'), 'utf8');

const lgplCaps: EngineCapabilities = { gpl: false, lut3d: true, colorkey: true, textShaping: false };

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
});
