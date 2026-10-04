// Whole-video time for beat anchors: where each section starts in the final timeline, and when beat n /
// bar n falls on the global beat grid. Pure; mirrors the director's assembly (a transition overlaps the
// two clips it joins, capped to half the shorter one, see editor/utils/transition-graph.ts).

import { DEFAULT_TRANSITION_DURATION } from '../../schemas/effects.schemas';

/** A tempo grid (`bpm`, first beat at `offset`) or explicit beat times from an analysis, in video seconds. */
export type Beats = { bpm: number; offset?: number; beatsPerBar?: number } | { times: number[]; beatsPerBar?: number };

interface TimelineTransition {
  type: string;
  duration?: number;
}

export interface TimelineSection {
  type: string;
  options?: { duration?: number };
  transition?: TimelineTransition;
}

// Sections that become clips in the final timeline (effect sections are resolved into clips first).
const RENDERED = new Set(['video', 'project_video', 'image_background', 'color_background', 'effect']);

/** Video time of beat `index` (1-based), or null when the grid has no such beat. */
export function beatTime(beats: Beats, index: number): number | null {
  if ('times' in beats) return beats.times.at(index - 1) ?? null;

  return (beats.offset ?? 0) + ((index - 1) * 60) / beats.bpm;
}

/** Video time of the downbeat of bar `index` (1-based). */
export function barTime(beats: Beats, index: number): number | null {
  return beatTime(beats, (index - 1) * (beats.beatsPerBar ?? 4) + 1);
}

/**
 * The section's length when it is known before any media is probed: its `options.duration`, except for a
 * recorded clip (`project_video`), whose length comes from the probe.
 */
export function knownDuration(section: TimelineSection): number | undefined {
  return section.type === 'project_video' ? undefined : section.options?.duration;
}

// How far the boundary after `previous` pulls the next section back: a transition overlaps both clips.
function boundaryOverlap(
  previous: { section: TimelineSection; duration: number | undefined },
  next: number | undefined,
  globalTransition: TimelineTransition | undefined
): number | null {
  const declared = previous.section.transition ?? globalTransition;

  if (!declared || declared.type === 'cut') return 0;

  if (previous.duration === undefined || next === undefined) return null;

  const duration = declared.duration ?? globalTransition?.duration ?? DEFAULT_TRANSITION_DURATION;

  return Math.min(duration, Math.min(previous.duration, next) / 2);
}

/**
 * Start of each section in the final video, by descriptor index: null for a section that is not rendered,
 * or whose start depends on a length only known once media is probed.
 */
export function sectionStarts(
  sections: readonly TimelineSection[],
  globalTransition?: TimelineTransition
): Array<number | null> {
  const starts: Array<number | null> = sections.map(() => null);
  let cursor: number | null = 0;
  let previous: { section: TimelineSection; duration: number | undefined } | undefined;

  for (const [index, section] of sections.entries()) {
    if (!RENDERED.has(section.type)) continue;

    const duration = knownDuration(section);
    const shift = previous ? boundaryOverlap(previous, duration, globalTransition) : 0;
    const start: number | null = cursor === null || shift === null ? null : cursor - shift;

    starts[index] = start;
    cursor = start === null || duration === undefined ? null : start + duration;
    previous = { section, duration };
  }

  return starts;
}
