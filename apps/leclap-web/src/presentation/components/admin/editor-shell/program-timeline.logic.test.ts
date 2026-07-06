import { describe, it, expect } from 'vitest';
import {
  buildMasterTimeline,
  totalDuration,
  sceneClockAt,
  transitionAt,
  kenburnsTransformAt,
  DEFAULT_SEGMENT_DURATION,
} from './program-timeline.logic';
import { newSection, type EditorSection } from '../templateEditorModel';

const video = (duration: number, transitionAfter?: { type: string; duration?: number }): EditorSection => ({
  ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
  duration,
  ...(transitionAfter ? { transitionAfter } : {}),
});

const color = (duration: number): EditorSection => ({
  ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
  duration,
});

describe('buildMasterTimeline', () => {
  it('concatenates visual scenes with cumulative bounds', () => {
    const timeline = buildMasterTimeline([video(8), color(3)]);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ index: 0, start: 0, end: 8, duration: 8 });
    expect(timeline[1]).toMatchObject({ index: 1, start: 8, end: 11, duration: 3 });
    expect(totalDuration(timeline)).toBe(11);
  });

  it('skips non-visual scenes but keeps original indices', () => {
    const timeline = buildMasterTimeline([newSection('music'), video(8), newSection('form'), color(3)]);
    expect(timeline.map((s) => s.index)).toEqual([1, 3]);
    expect(totalDuration(timeline)).toBe(11);
  });

  it('floors zero/NaN durations to the default', () => {
    const timeline = buildMasterTimeline([video(0), video(Number.NaN)]);
    expect(timeline[0].duration).toBe(DEFAULT_SEGMENT_DURATION);
    expect(timeline[1].duration).toBe(DEFAULT_SEGMENT_DURATION);
  });

  it('is empty for a template with no visual scene', () => {
    expect(buildMasterTimeline([newSection('music')])).toEqual([]);
    expect(totalDuration([])).toBe(0);
  });
});

describe('sceneClockAt', () => {
  const timeline = buildMasterTimeline([video(8), color(3)]);

  it('maps master time to the local scene clock', () => {
    expect(sceneClockAt(timeline, 0)).toMatchObject({ index: 0, localT: 0, progress: 0 });
    expect(sceneClockAt(timeline, 4)).toMatchObject({ index: 0, localT: 4, progress: 0.5 });
    expect(sceneClockAt(timeline, 9.5)).toMatchObject({ index: 1, localT: 1.5, progress: 0.5 });
  });

  it('assigns boundaries to the next segment', () => {
    expect(sceneClockAt(timeline, 8)).toMatchObject({ index: 1, localT: 0 });
  });

  it('clamps past-the-end to the last frame and negatives to the start', () => {
    expect(sceneClockAt(timeline, 99)).toMatchObject({ index: 1, localT: 3, progress: 1 });
    expect(sceneClockAt(timeline, -2)).toMatchObject({ index: 0, localT: 0 });
  });

  it('is null on an empty timeline', () => {
    expect(sceneClockAt([], 1)).toBeNull();
  });
});

describe('kenburnsTransformAt', () => {
  it('is null without a kenburns effect', () => {
    expect(kenburnsTransformAt(undefined, 0.5)).toBeNull();
    expect(kenburnsTransformAt([{ type: 'rotate', angle: 90 }], 0.5)).toBeNull();
  });

  it('zooms linearly for in/out', () => {
    const kb = (direction: 'in' | 'out') => [{ type: 'kenburns' as const, direction, intensity: 1.5 }];
    expect(kenburnsTransformAt(kb('in'), 0)).toBe('scale(1.0000)');
    expect(kenburnsTransformAt(kb('in'), 1)).toBe('scale(1.5000)');
    expect(kenburnsTransformAt(kb('out'), 0)).toBe('scale(1.5000)');
    expect(kenburnsTransformAt(kb('out'), 1)).toBe('scale(1.0000)');
  });

  it('pans at constant zoom and clamps progress', () => {
    const kb = [{ type: 'kenburns' as const, direction: 'left' as const, intensity: 1.2 }];
    expect(kenburnsTransformAt(kb, 0.5)).toBe('scale(1.2000) translate(3.00%, 0)');
    expect(kenburnsTransformAt(kb, 5)).toBe('scale(1.2000) translate(6.00%, 0)');
  });
});

describe('transitionAt', () => {
  it('activates only inside the blend window of a non-cut transition', () => {
    const timeline = buildMasterTimeline([video(8, { type: 'fade', duration: 1 }), color(3)]);
    expect(transitionAt(timeline, 6.5)).toBeNull();
    expect(transitionAt(timeline, 7.5)).toMatchObject({ fromIndex: 0, toIndex: 1, family: 'fade' });
    expect(transitionAt(timeline, 7.5)?.progress).toBeCloseTo(0.5, 5);
    expect(transitionAt(timeline, 8)).toBeNull(); // boundary belongs to the next scene
  });

  it('ignores cut transitions and dangling last transitions', () => {
    const cutLine = buildMasterTimeline([video(8, { type: 'cut' }), color(3)]);
    expect(transitionAt(cutLine, 7.9)).toBeNull();

    const dangling = buildMasterTimeline([video(8, { type: 'fade', duration: 1 })]);
    expect(transitionAt(dangling, 7.9)).toBeNull();
  });

  it('caps the window at half of each neighbour', () => {
    const timeline = buildMasterTimeline([video(8, { type: 'fade', duration: 5 }), color(2)]);
    // window = min(5, 8/2, 2/2) = 1 → starts at t=7
    expect(transitionAt(timeline, 6.9)).toBeNull();
    expect(transitionAt(timeline, 7.0)?.progress).toBeCloseTo(0, 5);
  });

  it('maps wipe-family names through previewFamilyFor', () => {
    const timeline = buildMasterTimeline([video(8, { type: 'wipeleft', duration: 1 }), color(3)]);
    expect(transitionAt(timeline, 7.5)?.family).toBe('wipe');
  });
});
