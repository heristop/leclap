// What a concrete FFmpeg build can render, as measured by the Node capability probe
// (platform/ffmpeg/capability-probe-node.ts), and what a template needs from it. Pure and platform-free:
// the validator turns the two into `feature_unavailable` advisories, and the Node render folds the report
// into the engine capabilities (editor/utils/filter-compat.ts) so a missing filter degrades with a
// warning instead of an FFmpeg error.

export type FeatureUsable = 'yes' | 'no' | 'unknown';

export interface FeatureStatus {
  usable: FeatureUsable;
  /** What the probe saw. */
  detail: string;
  /** What to do about it, when the feature is not usable. */
  fix?: string;
}

export const CAPABILITY_FEATURES = [
  'drawtext',
  'textShaping',
  'libass',
  'zscale',
  'tonemap',
  'lut3d',
  'xfade',
  'gblur',
  'alphamerge',
  'loudnorm',
  'ebur128',
  'libx264',
  'x264ColorParams',
  'gpl',
] as const;

export type CapabilityFeature = (typeof CAPABILITY_FEATURES)[number];

export interface CapabilityReport {
  ffmpeg: { path: string; version: string | null };
  features: Record<CapabilityFeature, FeatureStatus>;
  fonts: {
    /** The bundled font the drawtext probe rendered with, or null when none was found. */
    bundled: string | null;
    freetype: boolean;
    fontconfig: boolean;
    harfbuzz: boolean;
    fribidi: boolean;
  };
  encoders: string[];
}

/** The FFmpeg filters behind each filter-backed feature. */
export const FEATURE_FILTERS: Partial<Record<CapabilityFeature, readonly string[]>> = {
  drawtext: ['drawtext'],
  libass: ['subtitles', 'ass'],
  zscale: ['zscale'],
  tonemap: ['tonemap'],
  lut3d: ['lut3d'],
  xfade: ['xfade'],
  gblur: ['gblur'],
  alphamerge: ['alphamerge'],
  loudnorm: ['loudnorm'],
  ebur128: ['ebur128'],
};

/** GPL-only filters the engine may write (rewritten or dropped on an LGPL build). */
export const GPL_FILTERS: readonly string[] = ['eq', 'boxblur'];

/** What the engine takes from a probe report (editor/utils/filter-compat.ts). */
export interface ProbedCapabilities {
  /** Filters this build lacks or cannot run: dropped with a warning instead of failing the render. */
  missingFilters: ReadonlySet<string>;
  gpl: boolean;
  textShaping: boolean;
}

/** The engine capability overrides a probe report implies. Unknown features are assumed present. */
export function probedCapabilities(report: CapabilityReport): ProbedCapabilities {
  const missing = Object.entries(FEATURE_FILTERS).flatMap(([feature, filters]) =>
    report.features[feature as CapabilityFeature].usable === 'no' ? [...filters] : []
  );

  return {
    missingFilters: new Set(missing),
    gpl: report.features.gpl.usable !== 'no',
    textShaping: report.features.textShaping.usable === 'yes',
  };
}

/** The filter-backed feature a filter name belongs to, if any. */
export function featureOfFilter(filter: string): CapabilityFeature | undefined {
  if (GPL_FILTERS.includes(filter)) return 'gpl';

  const entry = Object.entries(FEATURE_FILTERS).find(([, filters]) => filters.includes(filter));

  return entry?.[0] as CapabilityFeature | undefined;
}
