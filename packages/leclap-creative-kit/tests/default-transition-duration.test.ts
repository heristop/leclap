import { describe, it, expect } from 'vitest';
import { DEFAULT_TRANSITION_DURATION } from 'ffmpeg-video-composer/src/schemas/effects.schemas.ts';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
} from '../src/editor/templateEditorModel';

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Transition duration test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('default transition duration', () => {
  it('matches the engine fallback so the editor never misstates what an unset duration renders', () => {
    expect(DEFAULT_TRANSITION_DURATION).toBe(0.3);
    expect(DEFAULT_TRANSITION.duration).toBe(DEFAULT_TRANSITION_DURATION);
  });

  it('re-hydrates a global transition without a duration to the engine fallback', () => {
    const state = stateWith([newSection('video')]);
    const template = templateFrom(state);
    // Simulate an imported descriptor that leaves the duration to the engine default.
    delete template.descriptor.global?.transition?.duration;

    const hydrated = toEditorState(template);
    expect(hydrated.defaultTransition.duration).toBe(DEFAULT_TRANSITION_DURATION);
    // Re-emitting renders identically: the explicit duration equals the engine fallback.
    expect(buildDescriptor(hydrated).global?.transition?.duration).toBe(DEFAULT_TRANSITION_DURATION);
  });

  it('round-trips a slow cinematic dissolve at the schema max (5s)', () => {
    const state = stateWith([newSection('video')]);
    state.defaultTransition = { type: 'fade', duration: 5 };

    const hydrated = toEditorState(templateFrom(state));
    expect(hydrated.defaultTransition).toEqual({ type: 'fade', duration: 5 });
  });
});
