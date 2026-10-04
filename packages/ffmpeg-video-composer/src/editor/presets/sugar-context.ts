// Context a sugar compiler needs to lower time/space-dependent effects (motion calibrates its
// Ken Burns curve over the clip length and scale). Built once per section by SegmentBuilder.
export type SugarContext = {
  duration: number;
  /** Output scale as 'W:H', e.g. '1280:720'. */
  scale: string;
  fps: number;
  /** True for real footage (project_video/video) so motion advances one output frame per input frame. */
  isVideo: boolean;
  /** `global.platform` (core/platforms.ts): the default caption clears that app's bottom UI. */
  platform?: string;
  /** `global.theme` (resolved per use): subtitle DNA colours may be `$color.*` tokens. */
  theme?: unknown;
  /** Motion inputs for kinetic typography (energy, seeds, text resolution). */
  motion?: KineticSugarContext;
};

export type KineticSugarContext = {
  energy: number;
  /** Derived seed for an element path inside the section (hash of global.seed and the path). */
  seedFor: (path: string) => number;
  /** Locale pick + variables + fields + section case, i.e. the final text to lay out. */
  resolveText: (text: Record<string, string | undefined>) => string;
};
