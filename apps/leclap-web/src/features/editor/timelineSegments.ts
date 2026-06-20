// Pure operations over a clip's ordered timeline of segments (see ClipSegment). Each function returns a
// new array; the UI hook holds the state and the compile pre-pass turns segments into ffmpeg filters.
import type { ClipSegment } from '@/domain/valueObjects/videoEdits';

// Offered playback speeds (pitch-preserved via atempo, which is valid for [0.5, 2]).
export const SPEED_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;

// Shortest slice a split or trim may leave, so the user can't create an unusable sliver. Kept small so
// brief clips stay splittable: at 0.3s a segment ≤0.6s couldn't be split at all (its valid interval was
// empty), which blocked splitting a short clip more than once.
const MIN_SEGMENT = 0.1;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// Monotonic id for segments created by a split; the value only has to be unique within a clip's timeline.
let idCounter = 0;
const nextId = (): string => `seg-${(idCounter += 1)}`;

/** Output (post-speed) length of one segment, in seconds. */
export const segmentOutputDuration = (s: ClipSegment): number => (s.end - s.start) / s.speed;

/** Total rendered length of the timeline, in seconds. */
export const timelineOutputDuration = (segments: ClipSegment[]): number =>
  segments.reduce((total, s) => total + segmentOutputDuration(s), 0);

/**
 * Split the segment that contains `t` (source seconds) into two contiguous halves. A no-op (returns the
 * same array) when `t` is within MIN_SEGMENT of an edge or falls in no segment, so splits can't create
 * slivers. The right half gets a fresh id; both inherit the original speed.
 */
export const splitAt = (segments: ClipSegment[], t: number): ClipSegment[] => {
  const index = segments.findIndex((s) => t > s.start + MIN_SEGMENT && t < s.end - MIN_SEGMENT);
  const s = segments.at(index);

  if (index === -1 || !s) return segments;

  const left: ClipSegment = { ...s, end: t };
  const right: ClipSegment = { id: nextId(), start: t, end: s.end, speed: s.speed };

  return [...segments.slice(0, index), left, right, ...segments.slice(index + 1)];
};

/** Set a segment's speed, clamped to the preset range. */
export const setSpeed = (segments: ClipSegment[], id: string, speed: number): ClipSegment[] => {
  const clamped = clamp(speed, MIN_SPEED, MAX_SPEED);

  return segments.map((s) => (s.id === id ? { ...s, speed: clamped } : s));
};

/**
 * Move one edge of a segment to `t` (source seconds). Segments are independent source ranges joined by
 * concat, so trimming an edge just narrows that range — clamped to [0, duration] and never crossing its
 * own opposite edge (keeps at least MIN_SEGMENT).
 */
export const trimEdge = (
  segments: ClipSegment[],
  id: string,
  side: 'start' | 'end',
  t: number,
  duration: number
): ClipSegment[] =>
  segments.map((s) => {
    if (s.id !== id) return s;

    if (side === 'start') return { ...s, start: clamp(t, 0, s.end - MIN_SEGMENT) };

    return { ...s, end: clamp(t, s.start + MIN_SEGMENT, duration) };
  });

/** Remove a segment, keeping at least one (deleting the last one is a no-op). */
export const deleteSegment = (segments: ClipSegment[], id: string): ClipSegment[] =>
  segments.length <= 1 ? segments : segments.filter((s) => s.id !== id);

/**
 * Compute the complement of the kept segments within [0, duration]: returns the gaps that were
 * previously cut out, each as a new speed-1 segment. Returns an empty array when there are no
 * gaps (the kept segments already cover the full timeline). Used by the "Inverse" timeline action.
 */
export const invertSegments = (segments: ClipSegment[], duration: number): ClipSegment[] => {
  const gaps: ClipSegment[] = [];
  let cursor = 0;

  for (const seg of segments) {
    if (seg.start - cursor > 0.01) {
      gaps.push({ id: `inv-${gaps.length}`, start: cursor, end: seg.start, speed: 1 });
    }

    cursor = seg.end;
  }

  if (duration - cursor > 0.01) {
    gaps.push({ id: `inv-${gaps.length}`, start: cursor, end: duration, speed: 1 });
  }

  return gaps;
};
