// The pure per-render override merge that `setupProjectConfig` layers over the engine's default
// ProjectConfig. Kept in its own side-effect-free module (rather than inline in
// coreCompilationService.ts, whose default export instantiates a BrowserFilesystemAdapter — a
// browser-only side effect a plain unit test must not trip) so the threading is directly testable.
import type { ProjectConfig } from 'ffmpeg-video-composer/src/core/types.d.ts';
import type { QualityTier } from 'ffmpeg-video-composer/src/core/encoding.ts';

// VideoConfig isn't exported from core types; derive it from the ProjectConfig field so the
// preview-render path can pass a reduced scale without a core change.
export type VideoConfigOverride = NonNullable<ProjectConfig['videoConfig']>;

// Each override is present only when the caller set it, so an unset one falls back to the engine's
// own default (see resolveTier's unknown-string fallback to 'standard' in encoding.ts).
export function buildConfigOverrides(
  videoConfig?: VideoConfigOverride,
  preset?: string,
  qualityTier?: QualityTier
): Partial<ProjectConfig> {
  return {
    ...(videoConfig ? { videoConfig } : {}),
    ...(preset ? { hardwareConfig: { preset } } : {}),
    ...(qualityTier ? { qualityTier } : {}),
  };
}
