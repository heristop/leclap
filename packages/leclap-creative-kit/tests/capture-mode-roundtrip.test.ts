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
  type CaptureMode,
} from '../src/editor/templateEditorModel';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Capture mode test',
  description: '',
  orientation: 'portrait',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const video = (extra: Partial<VideoSection> = {}): EditorSection => ({
  ...(newSection('video') as VideoSection),
  ...extra,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('capture mode (options.captureMode / options.allowedCaptureModes)', () => {
  it('emits options.captureMode when the author sets a default mode', () => {
    const descriptor = buildDescriptor(stateWith([video({ captureMode: 'back' })]));
    expect(descriptor.sections?.[0]?.options?.captureMode).toBe('back');
  });

  it('emits options.allowedCaptureModes when the author restricts the modes', () => {
    const allowed: CaptureMode[] = ['front', 'upload'];
    const descriptor = buildDescriptor(stateWith([video({ allowedCaptureModes: allowed })]));
    expect(descriptor.sections?.[0]?.options?.allowedCaptureModes).toEqual(['front', 'upload']);
  });

  it('emits neither field on an untouched section', () => {
    const options = buildDescriptor(stateWith([video()])).sections?.[0]?.options;
    expect(options).not.toHaveProperty('captureMode');
    expect(options).not.toHaveProperty('allowedCaptureModes');
  });

  it('emits nothing for an empty allowedCaptureModes list', () => {
    const options = buildDescriptor(stateWith([video({ allowedCaptureModes: [] })])).sections?.[0]?.options;
    expect(options).not.toHaveProperty('allowedCaptureModes');
  });

  it('round-trips both fields through toEditorState', () => {
    const state = stateWith([video({ captureMode: 'screen', allowedCaptureModes: ['screen', 'upload'] })]);

    const back = toEditorState(templateFrom(state));
    const section = back.sections[0] as VideoSection;
    expect(section.captureMode).toBe('screen');
    expect(section.allowedCaptureModes).toEqual(['screen', 'upload']);
  });

  it('leaves both fields absent after a round-trip of an untouched section', () => {
    const back = toEditorState(templateFrom(stateWith([video()])));
    expect(back.sections[0]).not.toHaveProperty('captureMode');
    expect(back.sections[0]).not.toHaveProperty('allowedCaptureModes');
  });

  it('drops a stored empty allowedCaptureModes list on import', () => {
    const state = stateWith([video()]);
    const descriptor = buildDescriptor(state);
    descriptor.sections![0]!.options = { ...descriptor.sections![0]!.options, allowedCaptureModes: [] };

    const back = toEditorState({ id: 'x', name: 'n', description: '', orientation: 'portrait', descriptor });
    expect(back.sections[0]).not.toHaveProperty('allowedCaptureModes');
  });
});
