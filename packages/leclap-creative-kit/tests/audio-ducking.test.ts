import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type AudioMix,
} from '../src/editor/templateEditorModel';

const stateWith = (ducking: AudioMix['ducking']): EditorState => ({
  id: makeTemplateId(),
  name: 'Ducking test',
  description: '',
  orientation: 'landscape',
  sections: [newSection('video')],
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX, ducking },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const roundTrip = (ducking: AudioMix['ducking']): AudioMix['ducking'] => {
  const state = stateWith(ducking);

  return toEditorState({
    id: state.id,
    name: state.name,
    description: '',
    orientation: 'landscape',
    descriptor: buildDescriptor(state),
  }).audio.ducking;
};

describe('audio ducking union (boolean | DuckingSettings)', () => {
  it('off emits nothing and reads back false', () => {
    expect(buildDescriptor(stateWith(false)).global?.audio).not.toHaveProperty('ducking');
    expect(roundTrip(false)).toBe(false);
  });

  it('on-with-defaults emits true and reads back true', () => {
    expect(buildDescriptor(stateWith(true)).global?.audio?.ducking).toBe(true);
    expect(roundTrip(true)).toBe(true);
  });

  it('a fine-tuned object passes through the descriptor', () => {
    const tuned = { threshold: 0.1, ratio: 12, attack: 30, release: 500 };
    expect(buildDescriptor(stateWith(tuned)).global?.audio?.ducking).toEqual(tuned);
    expect(roundTrip(tuned)).toEqual(tuned);
  });

  it('collapses an emptied fine-tune object back to true', () => {
    expect(buildDescriptor(stateWith({})).global?.audio?.ducking).toBe(true);
  });

  it('keeps a partial object partial (unset knobs use engine defaults)', () => {
    expect(buildDescriptor(stateWith({ ratio: 4 })).global?.audio?.ducking).toEqual({ ratio: 4 });
  });
});
