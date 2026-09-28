// The about page's story, as data: each beat is a release that actually shipped, dated from the packages'
// CHANGELOGs (ffmpeg-video-composer 0.1.0, then 2.0.0 alongside @leclap/cli and @leclap/mcp 0.1.0), and
// the last beat is the present. Copy lives in about.json under story.chapters.<id>.

export type StoryChapterId = 'origin' | 'everywhere' | 'now';

export interface StoryChapter {
  id: StoryChapterId;
  /** The release that marks the beat, as published; null for the present. */
  version: string | null;
  /** ISO date the release shipped; null for the present. */
  date: string | null;
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  { id: 'origin', version: 'v0.1.0', date: '2024-05-01' },
  { id: 'everywhere', version: 'v2.0.0', date: '2026-06-27' },
  { id: 'now', version: null, date: null },
];

/**
 * A release month the way the reader writes one ("May 2024", "mayo de 2024"). Read in UTC: an ISO date
 * parses as UTC midnight, so formatting it in a timezone west of Greenwich would slip the first of a
 * month back into the previous one.
 */
export const storyMonth = (isoDate: string, lang: string): string =>
  new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(isoDate));
