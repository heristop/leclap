import { describe, it, expect } from 'vitest';
import { buildConfigOverrides } from './compile-config-overrides';

// `buildConfigOverrides` is the pure seam `setupProjectConfig` merges over the engine's default
// ProjectConfig — each override (videoConfig / preset / qualityTier) is present only when the caller
// set it, so these checks stand in for exercising the private method directly.
describe('buildConfigOverrides', () => {
  it('passes qualityTier through verbatim when set', () => {
    expect(buildConfigOverrides(undefined, undefined, 'high')).toEqual({ qualityTier: 'high' });
    expect(buildConfigOverrides(undefined, undefined, 'draft')).toEqual({ qualityTier: 'draft' });
    expect(buildConfigOverrides(undefined, undefined, 'standard')).toEqual({ qualityTier: 'standard' });
  });

  it('omits qualityTier when unset', () => {
    const overrides = buildConfigOverrides(undefined, undefined, undefined);
    expect(overrides).not.toHaveProperty('qualityTier');
    expect(overrides).toEqual({});
  });

  it('combines with the existing videoConfig/preset overrides without interference', () => {
    const overrides = buildConfigOverrides({ scale: '0.5' }, 'ultrafast', 'high');
    expect(overrides).toEqual({
      videoConfig: { scale: '0.5' },
      hardwareConfig: { preset: 'ultrafast' },
      qualityTier: 'high',
    });
  });
});
