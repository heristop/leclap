import { describe, it, expect } from 'vitest';
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
  name: 'Speed test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const video = (speed?: number): EditorSection => ({
  ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
  ...(speed === undefined ? {} : { speed }),
});

describe('section speed (options.speed, PTS multiplier)', () => {
  it('emits options.speed for a non-default tempo', () => {
    const descriptor = buildDescriptor(stateWith([video(0.5)]));
    expect(descriptor.sections?.[0]?.options?.speed).toBe(0.5);
  });

  it('emits nothing for normal speed (unset or 1)', () => {
    expect(buildDescriptor(stateWith([video()])).sections?.[0]?.options).not.toHaveProperty('speed');
    expect(buildDescriptor(stateWith([video(1)])).sections?.[0]?.options).not.toHaveProperty('speed');
  });

  it('round-trips through toEditorState for video, color and image sections', () => {
    const color: EditorSection = {
      ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
      speed: 2,
    };
    const image: EditorSection = {
      ...(newSection('image') as Extract<EditorSection, { kind: 'image' }>),
      allowUpload: true,
      speed: 0.25,
    };
    const state = stateWith([video(0.5), color, image]);
    const template = {
      id: state.id,
      name: state.name,
      description: state.description,
      orientation: state.orientation,
      descriptor: buildDescriptor(state),
    };

    const back = toEditorState(template);
    const speeds = back.sections.map((s) => ('speed' in s ? s.speed : undefined));
    expect(speeds).toEqual([0.5, 2, 0.25]);
  });

  it('drops a stored speed of exactly 1 on import', () => {
    const state = stateWith([video()]);
    const descriptor = buildDescriptor(state);
    descriptor.sections![0]!.options = { ...descriptor.sections![0]!.options, speed: 1 };

    const back = toEditorState({ id: 'x', name: 'n', description: '', orientation: 'landscape', descriptor });
    expect(back.sections[0]).not.toHaveProperty('speed');
  });
});
