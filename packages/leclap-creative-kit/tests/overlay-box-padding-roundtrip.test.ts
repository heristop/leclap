import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  newOverlay,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
  type TextOverlay,
} from '../src/editor/templateEditorModel';

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Box padding test',
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

const videoWith = (overlays: TextOverlay[]): EditorSection => ({
  ...(newSection('video') as VideoSection),
  overlays,
});

const boxedOverlay = (extra: Partial<TextOverlay> = {}): TextOverlay => ({
  ...newOverlay(),
  text: 'Hello',
  box: true,
  ...extra,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

const firstDrawtextValues = (state: EditorState) => {
  const filters = buildDescriptor(state).sections?.[0]?.filters ?? [];
  const drawtext = filters.find((f) => f.type === 'drawtext');

  return drawtext?.values ?? {};
};

describe('overlay box padding (drawtext boxborderw)', () => {
  it('emits the authored boxPadding as boxborderw', () => {
    const values = firstDrawtextValues(stateWith([videoWith([boxedOverlay({ boxPadding: 28 })])]));

    expect(values.boxborderw).toBe(28);
  });

  it('keeps the historical 12px default when boxPadding is unset', () => {
    const values = firstDrawtextValues(stateWith([videoWith([boxedOverlay()])]));

    expect(values.boxborderw).toBe(12);
  });

  it('emits no box keys at all while the box is off', () => {
    const values = firstDrawtextValues(stateWith([videoWith([boxedOverlay({ box: false, boxPadding: 28 })])]));

    expect(values).not.toHaveProperty('boxborderw');
    expect(values).not.toHaveProperty('box');
  });

  it('round-trips boxPadding through toEditorState', () => {
    const back = toEditorState(templateFrom(stateWith([videoWith([boxedOverlay({ boxPadding: 28 })])])));
    const section = back.sections[0] as VideoSection;

    expect(section.overlays[0]?.boxPadding).toBe(28);
  });

  it('re-hydrates a default-padding overlay with no boxPadding field', () => {
    const back = toEditorState(templateFrom(stateWith([videoWith([boxedOverlay()])])));
    const section = back.sections[0] as VideoSection;

    expect(section.overlays[0]).not.toHaveProperty('boxPadding');
  });

  it('collapses an explicitly-default boxPadding of 12 back to an absent field', () => {
    const back = toEditorState(templateFrom(stateWith([videoWith([boxedOverlay({ boxPadding: 12 })])])));
    const section = back.sections[0] as VideoSection;

    expect(section.overlays[0]).not.toHaveProperty('boxPadding');
  });

  it('tolerates a hand-authored per-side boxborderw string (falls back to no boxPadding)', () => {
    const state = stateWith([videoWith([boxedOverlay()])]);
    const template = templateFrom(state);
    const drawtext = template.descriptor.sections?.[0]?.filters?.find((f) => f.type === 'drawtext');

    if (drawtext?.values) drawtext.values.boxborderw = '10|24|10|24';

    const back = toEditorState(template);
    const section = back.sections[0] as VideoSection;

    expect(section.overlays[0]?.box).toBe(true);
    expect(section.overlays[0]).not.toHaveProperty('boxPadding');
  });
});
