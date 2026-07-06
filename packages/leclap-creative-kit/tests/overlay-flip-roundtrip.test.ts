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
  type AnimationOverlay,
  type ImageOverlay,
} from '../src/editor/templateEditorModel';

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Flip test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const videoWith = (extra: Partial<VideoSection>): EditorSection => ({
  ...(newSection('video') as VideoSection),
  ...extra,
});

const animation = (extra: Partial<AnimationOverlay> = {}): AnimationOverlay => ({
  id: 'a1',
  url: '/assets/animations/confetti.apng',
  ...extra,
});

const image = (extra: Partial<ImageOverlay> = {}): ImageOverlay => ({
  id: 'i1',
  choice: { source: 'library', id: 'logo' },
  ...extra,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('overlay flip (input options.flip)', () => {
  it('emits flip on an animation input only when set', () => {
    const flipped = buildDescriptor(stateWith([videoWith({ animations: [animation({ flip: 'horizontal' })] })]));
    expect(flipped.sections?.[0]?.inputs?.[0]?.options?.flip).toBe('horizontal');

    const plain = buildDescriptor(stateWith([videoWith({ animations: [animation()] })]));
    expect(plain.sections?.[0]?.inputs?.[0]?.options).not.toHaveProperty('flip');
  });

  it('emits flip on an image input only when set', () => {
    const flipped = buildDescriptor(stateWith([videoWith({ images: [image({ flip: 'both' })] })]));
    expect(flipped.sections?.[0]?.inputs?.[0]?.options?.flip).toBe('both');

    const plain = buildDescriptor(stateWith([videoWith({ images: [image()] })]));
    expect(plain.sections?.[0]?.inputs?.[0]?.options).not.toHaveProperty('flip');
  });

  it('emits flip on a whole-video global animation', () => {
    const state = stateWith([videoWith({})]);
    state.globalAnimations = [animation({ flip: 'vertical' })];

    const descriptor = buildDescriptor(state);
    expect(descriptor.global?.animations?.[0]?.flip).toBe('vertical');
  });

  it('round-trips animation and image flips through toEditorState', () => {
    const state = stateWith([
      videoWith({
        animations: [animation({ flip: 'vertical' })],
        images: [image({ flip: 'horizontal' })],
      }),
    ]);

    const back = toEditorState(templateFrom(state));
    const section = back.sections[0] as VideoSection;

    expect(section.animations?.[0]?.flip).toBe('vertical');
    expect(section.images?.[0]?.flip).toBe('horizontal');
  });

  it('re-hydrates an unflipped overlay with no flip field', () => {
    const back = toEditorState(templateFrom(stateWith([videoWith({ animations: [animation()], images: [image()] })])));
    const section = back.sections[0] as VideoSection;

    expect(section.animations?.[0]).not.toHaveProperty('flip');
    expect(section.images?.[0]).not.toHaveProperty('flip');
  });
});
