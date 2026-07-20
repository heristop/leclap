import type { Section, TemplateDescriptor } from '@/core/types';

// Section types the director turns into actual video/audio segments (mirrors TemplateDirector's
// `videoSegmentTypes`). Partials are already expanded into these by the time the engine runs, so
// their sections show up here too; anything else (e.g. `form`) never reaches the timeline and must
// not shrink the music-fade cap below what the rendered sections actually allow.
const RENDERABLE_SECTION_TYPES = new Set(['video', 'project_video', 'image_background', 'color_background']);

// Half the shortest renderable section's duration, or +Infinity when there's nothing to cap
// against. The acrossfade eats `fade` seconds off BOTH adjacent legs, so a fade at or beyond half
// a section's length would crossfade that section away entirely. Sections with no/zero duration
// (e.g. `form`) are ignored rather than collapsing the cap to 0.
export function maxMusicFadeFromSections(sections: unknown): number {
  const list = Array.isArray(sections) ? (sections as Section[]) : [];
  const durations = list
    .filter((section) => RENDERABLE_SECTION_TYPES.has(section.type))
    .map((section) => section.options?.duration ?? 0)
    .filter((duration) => duration > 0);

  if (durations.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...durations) / 2;
}

/**
 * Resolve the music cross-fade length. `global.audio.musicFade` decouples the music leg-to-leg
 * blend from the video transition — unset, it falls back to `transitionDuration` so existing
 * templates render unchanged. Either way it's capped at half the shortest renderable section
 * (maxMusicFadeFromSections) so a short section can never be entirely consumed by the crossfade,
 * with 0.05s as an absolute floor.
 */
export function resolveMusicFade(descriptor: TemplateDescriptor, transitionDuration: number): number {
  const requested = descriptor.global?.audio?.musicFade ?? transitionDuration;
  const cap = maxMusicFadeFromSections(descriptor.sections);

  return Math.max(0.05, Math.min(requested, cap));
}

export type MusicFilterOptions = {
  baseFilter: string;
  isFirstSection: boolean;
  isLastSection: boolean;
  transitionDuration: number;
  duration: number;
  musicVolumeLevel: number;
  mapName: string;
};

// Per-section music filter: afade in/out (video-synced fade to/from silence) for the outer
// sections, plain volume for everything in between. Kept alongside the fade-length resolution
// above since both concern the music track's per-section filter chain.
export function buildMusicFilter(opts: MusicFilterOptions): string {
  const { baseFilter, isFirstSection, isLastSection, transitionDuration, duration, musicVolumeLevel, mapName } = opts;

  if (isFirstSection) {
    return `${baseFilter},afade=t=in:st=0:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
  }

  if (isLastSection) {
    return `${baseFilter},afade=t=out:st=${duration - transitionDuration}:d=${transitionDuration},volume=${musicVolumeLevel}[${mapName}];`;
  }

  return `${baseFilter},volume=${musicVolumeLevel}[${mapName}];`;
}
