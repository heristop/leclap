import { describe, it, expect } from 'vitest';
import {
  splitAt,
  setSpeed,
  trimEdge,
  deleteSegment,
  invertSegments,
  segmentOutputDuration,
  timelineOutputDuration,
  SPEED_PRESETS,
} from '@/features/editor/timelineSegments';
import type { ClipSegment } from '@/domain/valueObjects/videoEdits';

const seg = (start: number, end: number, speed = 1, id = `s-${start}-${end}`): ClipSegment => ({
  id,
  start,
  end,
  speed,
});

describe('splitAt', () => {
  it('splits the segment under the time into two contiguous halves, preserving speed', () => {
    const out = splitAt([seg(0, 10, 1.5, 'a')], 4);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ start: 0, end: 4, speed: 1.5 });
    expect(out[1]).toMatchObject({ start: 4, end: 10, speed: 1.5 });
    expect(out[1].id).not.toBe(out[0].id);
  });

  it('splits the correct segment among several', () => {
    const out = splitAt([seg(0, 5, 1, 'a'), seg(5, 12, 1, 'b')], 8);

    expect(out.map((s) => [s.start, s.end])).toEqual([
      [0, 5],
      [5, 8],
      [8, 12],
    ]);
  });

  it('ignores a split too close to a segment edge (no slivers)', () => {
    const input = [seg(0, 10, 1, 'a')];
    expect(splitAt(input, 0.1)).toBe(input);
    expect(splitAt(input, 9.95)).toBe(input);
  });

  it('returns the same array reference when the time falls in no segment', () => {
    const input = [seg(2, 5, 1, 'a'), seg(7, 10, 1, 'b')];
    // t=6 is between the two segments — no match, no-op
    expect(splitAt(input, 6)).toBe(input);
  });

  it('can split a sub-second segment so a brief clip can be cut several times', () => {
    // A ~1.2s clip already halved into two 0.6s segments must still split again (regression: the min
    // segment length was 0.3s, which made any segment ≤0.6s unsplittable — Split silently did nothing).
    const halves = [seg(0, 0.6, 1, 'a'), seg(0.6, 1.2, 1, 'b')];
    const out = splitAt(halves, 0.9);

    expect(out.map((s) => [s.start, s.end])).toEqual([
      [0, 0.6],
      [0.6, 0.9],
      [0.9, 1.2],
    ]);
  });

  it('increments the split count so each new right-half gets a unique id', () => {
    const base = [seg(0, 20, 1, 'a')];
    const first = splitAt(base, 5);
    const second = splitAt(first, 12);

    const ids = second.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('setSpeed', () => {
  it('sets the speed on the matching segment only', () => {
    const out = setSpeed([seg(0, 5, 1, 'a'), seg(5, 9, 1, 'b')], 'b', 2);
    expect(out.map((s) => s.speed)).toEqual([1, 2]);
  });

  it('clamps an out-of-range speed into the preset bounds', () => {
    expect(setSpeed([seg(0, 5, 1, 'a')], 'a', 9)[0].speed).toBe(2);
    expect(setSpeed([seg(0, 5, 1, 'a')], 'a', 0.1)[0].speed).toBe(0.5);
  });

  it('accepts every preset speed without clamping', () => {
    for (const preset of SPEED_PRESETS) {
      expect(setSpeed([seg(0, 5, 1, 'a')], 'a', preset)[0].speed).toBe(preset);
    }
  });

  it('is a no-op when the id does not match any segment', () => {
    const input = [seg(0, 5, 1, 'a')];
    const out = setSpeed(input, 'missing', 2);
    expect(out[0].speed).toBe(1);
  });
});

describe('trimEdge', () => {
  it('moves the start edge but never past end minus the minimum slice', () => {
    expect(trimEdge([seg(0, 5, 1, 'a')], 'a', 'start', 2, 10)[0].start).toBe(2);
    expect(trimEdge([seg(0, 5, 1, 'a')], 'a', 'start', 4.99, 10)[0].start).toBeLessThan(5);
  });

  it('moves the end edge clamped to the clip duration', () => {
    expect(trimEdge([seg(0, 5, 1, 'a')], 'a', 'end', 8, 10)[0].end).toBe(8);
    expect(trimEdge([seg(0, 5, 1, 'a')], 'a', 'end', 99, 10)[0].end).toBe(10);
  });

  it('does not let start go below 0', () => {
    expect(trimEdge([seg(1, 5, 1, 'a')], 'a', 'start', -3, 10)[0].start).toBe(0);
  });

  it('does not let end go below start + minimum', () => {
    const out = trimEdge([seg(0, 5, 1, 'a')], 'a', 'end', 0.1, 10);
    expect(out[0].end).toBeGreaterThan(out[0].start);
  });

  it('is a no-op on other segments', () => {
    const input = [seg(0, 5, 1, 'a'), seg(5, 9, 1, 'b')];
    const out = trimEdge(input, 'a', 'end', 3, 10);
    expect(out[1]).toBe(input[1]);
  });
});

describe('deleteSegment', () => {
  it('removes the segment by id', () => {
    expect(deleteSegment([seg(0, 5, 1, 'a'), seg(5, 9, 1, 'b')], 'a')).toHaveLength(1);
  });

  it('never deletes the last remaining segment', () => {
    const only = [seg(0, 5, 1, 'a')];
    expect(deleteSegment(only, 'a')).toBe(only);
  });

  it('is a no-op when the id does not match', () => {
    const input = [seg(0, 5, 1, 'a'), seg(5, 9, 1, 'b')];
    expect(deleteSegment(input, 'missing')).toHaveLength(2);
  });

  it('preserves the other segment unchanged after deletion', () => {
    const b = seg(5, 9, 2, 'b');
    const out = deleteSegment([seg(0, 5, 1, 'a'), b], 'a');
    expect(out[0]).toBe(b);
  });
});

describe('output durations', () => {
  it('scales a segment by its speed', () => {
    expect(segmentOutputDuration(seg(0, 6, 2))).toBe(3);
    expect(timelineOutputDuration([seg(0, 6, 2), seg(6, 12, 1)])).toBe(9);
  });

  it('a slow-motion segment runs longer than its source length', () => {
    expect(segmentOutputDuration(seg(0, 4, 0.5))).toBe(8);
  });

  it('sums zero for an empty timeline', () => {
    expect(timelineOutputDuration([])).toBe(0);
  });
});

describe('invertSegments', () => {
  it('returns an empty array when a single segment covers the full clip', () => {
    expect(invertSegments([seg(0, 10)], 10)).toHaveLength(0);
  });

  it('returns the gap when one segment is cut from the middle', () => {
    // Kept: [3–7] → gaps: [0–3] and [7–10]
    const out = invertSegments([seg(3, 7, 1, 'a')], 10);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ start: 0, end: 3, speed: 1 });
    expect(out[1]).toMatchObject({ start: 7, end: 10, speed: 1 });
  });

  it('returns a trailing gap when the kept segment ends before the clip', () => {
    const out = invertSegments([seg(0, 6, 1, 'a')], 10);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: 6, end: 10, speed: 1 });
  });

  it('returns a leading gap when the kept segment starts after 0', () => {
    const out = invertSegments([seg(4, 10, 1, 'a')], 10);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: 0, end: 4, speed: 1 });
  });

  it('handles multiple kept segments with gaps between and at the ends', () => {
    // Kept: [2–4] and [6–8] in a 10s clip → gaps: [0–2], [4–6], [8–10]
    const out = invertSegments([seg(2, 4, 1, 'a'), seg(6, 8, 1, 'b')], 10);

    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ start: 0, end: 2 });
    expect(out[1]).toMatchObject({ start: 4, end: 6 });
    expect(out[2]).toMatchObject({ start: 8, end: 10 });
  });

  it('produces speed-1 gap segments regardless of the kept segments speed', () => {
    const out = invertSegments([seg(2, 8, 2, 'a')], 10);

    for (const g of out) {
      expect(g.speed).toBe(1);
    }
  });

  it('assigns deterministic ids (inv-0, inv-1 …) to gap segments', () => {
    const out = invertSegments([seg(3, 7, 1, 'a')], 10);

    expect(out[0].id).toBe('inv-0');
    expect(out[1].id).toBe('inv-1');
  });

  it('ignores epsilon-level gaps (< 0.01 s) at segment boundaries', () => {
    // Adjacent segments with floating-point touch — no gap should appear between them.
    const out = invertSegments([seg(0, 5.001, 1, 'a'), seg(5.001, 10, 1, 'b')], 10);

    expect(out).toHaveLength(0);
  });

  it('inverted twice returns a set with the same total duration as the original', () => {
    const original = [seg(0, 3, 1, 'a'), seg(5, 8, 1, 'b')];
    const duration = 10;
    const first = invertSegments(original, duration);
    const second = invertSegments(first, duration);

    const sum = (segs: ClipSegment[]) => segs.reduce((t, s) => t + (s.end - s.start), 0);
    expect(sum(original) + sum(first)).toBeCloseTo(duration, 5);
    expect(sum(second)).toBeCloseTo(sum(original), 5);
  });
});
