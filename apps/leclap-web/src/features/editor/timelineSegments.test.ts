import { describe, it, expect } from 'vitest';
import {
  splitAt,
  setSpeed,
  trimEdge,
  deleteSegment,
  segmentOutputDuration,
  timelineOutputDuration,
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
});

describe('deleteSegment', () => {
  it('removes the segment by id', () => {
    expect(deleteSegment([seg(0, 5, 1, 'a'), seg(5, 9, 1, 'b')], 'a')).toHaveLength(1);
  });

  it('never deletes the last remaining segment', () => {
    const only = [seg(0, 5, 1, 'a')];
    expect(deleteSegment(only, 'a')).toBe(only);
  });
});

describe('output durations', () => {
  it('scales a segment by its speed', () => {
    expect(segmentOutputDuration(seg(0, 6, 2))).toBe(3);
    expect(timelineOutputDuration([seg(0, 6, 2), seg(6, 12, 1)])).toBe(9);
  });
});
