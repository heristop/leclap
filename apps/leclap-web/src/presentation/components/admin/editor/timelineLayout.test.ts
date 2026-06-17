import { describe, it, expect } from 'vitest';
import { newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import { computeTimeline } from './timelineLayout';

function state(sections: EditorSection[]): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections,
    globalVariables: [],
    audio: { sourceVolume: 1, musicVolume: 0.5, ducking: false },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
  };
}

function video(duration: number): EditorSection {
  return { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), duration };
}

describe('computeTimeline', () => {
  it('returns no chips when there are no visual sections', () => {
    expect(computeTimeline(state([newSection('form'), newSection('music')]))).toHaveLength(0);
  });

  it('emits one chip per visual section, skipping form/music', () => {
    const chips = computeTimeline(state([newSection('music'), video(4), newSection('form'), newSection('color')]));
    expect(chips.map((c) => c.kind)).toEqual(['video', 'color']);
    // editorIndex tracks the original positions (music=0, video=1, form=2, color=3).
    expect(chips.map((c) => c.editorIndex)).toEqual([1, 3]);
  });

  it('sizes chips proportionally to duration and always sums to ~100', () => {
    const chips = computeTimeline(state([video(2), video(6)]));
    expect(chips[0].widthPct).toBeCloseTo(25, 5);
    expect(chips[1].widthPct).toBeCloseTo(75, 5);
    expect(chips[0].widthPct + chips[1].widthPct).toBeCloseTo(100, 5);
  });

  it('falls back to equal widths when durations are all equal', () => {
    const chips = computeTimeline(state([video(3), video(3), video(3)]));
    const total = chips.reduce((sum, c) => sum + c.widthPct, 0);
    expect(total).toBeCloseTo(100, 5);
    // First two are equal; the last absorbs rounding.
    expect(chips[0].widthPct).toBeCloseTo(chips[1].widthPct, 5);
  });

  it('carries the color swatch and the boundary transition', () => {
    const first = { ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>) };
    first.color = '#123456';
    first.transitionAfter = { type: 'fade', duration: 0.5 };
    const chips = computeTimeline(state([first, video(3)]));
    expect(chips[0].color).toBe('#123456');
    expect(chips[0].transitionAfter?.type).toBe('fade');
    expect(chips[1].transitionAfter).toBeUndefined();
  });
});
