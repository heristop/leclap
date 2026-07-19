import { describe, it, expect } from 'vitest';
import { applyFilterCompat, engineCapabilities } from '@/editor/utils/filter-compat';
import { DEVICE_FILTERS } from '@/editor/utils/device-filters.generated';
import type { ProjectConfig } from '@/core/types';

const lgplConfig = { codecConfig: { videoCodec: 'libopenh264' } } as unknown as ProjectConfig;
const fullConfig = { codecConfig: { videoCodec: '' } } as unknown as ProjectConfig;

describe('device capability set', () => {
  it('LGPL engines expose the generated device filter set; full builds expose null', () => {
    expect(engineCapabilities(lgplConfig).deviceFilters).toBe(DEVICE_FILTERS);
    expect(engineCapabilities(fullConfig).deviceFilters).toBeNull();
  });

  it('an authored filter absent on device is dropped (null), kept on full builds', () => {
    // boxblur is GPL-only (configure: boxblur_filter_deps="gpl") and deliberately absent from the
    // on-device --enable-filter allowlist — see scripts/ffmpeg/common.sh.
    const boxblur = { type: 'boxblur', value: '2:1' };
    expect(applyFilterCompat(boxblur, engineCapabilities(lgplConfig))).toBeNull();
    expect(applyFilterCompat(boxblur, engineCapabilities(fullConfig))).toEqual(boxblur);
  });

  it('the eq rewrite still wins before the drop rule (lutyuv is device-enabled)', () => {
    const eq = { type: 'eq', value: 'contrast=1.1' };
    const resolved = applyFilterCompat(eq, engineCapabilities(lgplConfig));
    expect(resolved?.type).toBe('lutyuv');
  });
});
