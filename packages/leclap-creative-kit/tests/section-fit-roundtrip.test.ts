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
  type SectionFit,
} from '../src/editor/templateEditorModel';

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Fit test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

const video = (fit?: SectionFit): EditorSection => ({
  ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
  ...(fit === undefined ? {} : { fit }),
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('section fit (options.forceAspectRatio / forceOriginalAspectRatio)', () => {
  it('emits nothing for the default cover fit (unset or "cover")', () => {
    const unset = buildDescriptor(stateWith([video()])).sections?.[0]?.options;
    expect(unset).not.toHaveProperty('forceAspectRatio');
    expect(unset).not.toHaveProperty('forceOriginalAspectRatio');

    const cover = buildDescriptor(stateWith([video('cover')])).sections?.[0]?.options;
    expect(cover).not.toHaveProperty('forceAspectRatio');
    expect(cover).not.toHaveProperty('forceOriginalAspectRatio');
  });

  it('emits forceOriginalAspectRatio for letterbox', () => {
    const options = buildDescriptor(stateWith([video('letterbox')])).sections?.[0]?.options;
    expect(options?.forceOriginalAspectRatio).toBe(true);
    expect(options).not.toHaveProperty('forceAspectRatio');
  });

  it('emits forceAspectRatio: false for off', () => {
    const options = buildDescriptor(stateWith([video('off')])).sections?.[0]?.options;
    expect(options?.forceAspectRatio).toBe(false);
    expect(options).not.toHaveProperty('forceOriginalAspectRatio');
  });

  it('emits the fit on asset-backed clip sections too', () => {
    const clip: EditorSection = {
      ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
      videoUrl: { source: 'library', id: 'bumper' },
      fit: 'letterbox',
    };
    const section = buildDescriptor(stateWith([clip])).sections?.[0];
    expect(section?.type).toBe('video');
    expect(section?.options?.forceOriginalAspectRatio).toBe(true);
  });

  it('round-trips through toEditorState for video and image sections', () => {
    const image: EditorSection = {
      ...(newSection('image') as Extract<EditorSection, { kind: 'image' }>),
      allowUpload: true,
      fit: 'off',
    };
    const back = toEditorState(templateFrom(stateWith([video('letterbox'), image])));

    const fits = back.sections.map((s) => ('fit' in s ? s.fit : undefined));
    expect(fits).toEqual(['letterbox', 'off']);
  });

  it('re-hydrates the default cover fit as an absent field', () => {
    const back = toEditorState(templateFrom(stateWith([video()])));
    expect(back.sections[0]).not.toHaveProperty('fit');
  });

  it('prefers letterbox when a stored descriptor sets both flags (engine precedence)', () => {
    const state = stateWith([video()]);
    const descriptor = buildDescriptor(state);
    descriptor.sections![0]!.options = {
      ...descriptor.sections![0]!.options,
      forceAspectRatio: false,
      forceOriginalAspectRatio: true,
    };

    const back = toEditorState({ id: 'x', name: 'n', description: '', orientation: 'landscape', descriptor });
    const first = back.sections[0] as Extract<EditorSection, { kind: 'video' }>;
    expect(first.fit).toBe('letterbox');
  });
});
