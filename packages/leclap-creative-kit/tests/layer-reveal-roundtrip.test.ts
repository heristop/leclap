// Entrance (`reveal`) on background layers + reveal-timed text-overlay accent bars.
//
// - a layer `reveal` rides the descriptor's options.layers wholesale (layers pass through
//   buildDescriptor/toEditorState untouched), so both directions must keep the field.
// - the kit-emitted accent bar drawbox follows its drawtext's reveal timing via a timeline gate
//   (`enable='gte(t,delay)'`) so the bar never appears before its text; overlays without a reveal
//   keep emitting the exact same drawbox (backward compatible), and the accent still round-trips.
import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type BackgroundLayer,
  type EditorState,
  type EditorSection,
  type TextOverlay,
} from '../src/editor/templateEditorModel';

const stateWith = (sections: EditorSection[]): EditorState => ({
  id: makeTemplateId(),
  name: 'Layer reveal test',
  description: '',
  orientation: 'landscape',
  sections,
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
});

type ColorSection = Extract<EditorSection, { kind: 'color' }>;
type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const colorWith = (extra: Partial<ColorSection>): EditorSection => ({
  ...(newSection('color') as ColorSection),
  ...extra,
});

const videoWith = (extra: Partial<VideoSection>): EditorSection => ({
  ...(newSection('video') as VideoSection),
  ...extra,
});

const overlay = (extra: Partial<TextOverlay> = {}): TextOverlay => ({
  text: 'Hello',
  x: 0.25,
  y: 0.8,
  fontsize: 50,
  fontcolor: '#ffffff',
  font: 'rubik',
  box: false,
  boxcolor: '#000000',
  boxOpacity: 0.5,
  ...extra,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('background layer reveal round-trip', () => {
  const layers: BackgroundLayer[] = [
    { color: '#101820' },
    { gradient: { from: '#000000', to: '#ff0044' }, reveal: 'fade' },
    { color: '#ffffff', opacity: 0.4, reveal: { type: 'rise', delay: 0.8, duration: 1 } },
  ];

  it('emits the layer reveal into options.layers only when set', () => {
    const descriptor = buildDescriptor(stateWith([colorWith({ layers })]));
    const emitted = descriptor.sections?.[0]?.options?.layers as BackgroundLayer[];

    expect(emitted[0]).not.toHaveProperty('reveal');
    expect(emitted[1]?.reveal).toBe('fade');
    expect(emitted[2]?.reveal).toEqual({ type: 'rise', delay: 0.8, duration: 1 });
  });

  it('re-hydrates the layer reveal through toEditorState', () => {
    const back = toEditorState(templateFrom(stateWith([colorWith({ layers })])));
    const section = back.sections[0] as ColorSection;

    expect(section.layers?.[0]).not.toHaveProperty('reveal');
    expect(section.layers?.[1]?.reveal).toBe('fade');
    expect(section.layers?.[2]?.reveal).toEqual({ type: 'rise', delay: 0.8, duration: 1 });
  });
});

describe('text-overlay accent bar follows the reveal timing', () => {
  it('gates the accent drawbox at the reveal delay', () => {
    const descriptor = buildDescriptor(
      stateWith([videoWith({ overlays: [overlay({ accent: '#ff8800', reveal: 'rise' })] })])
    );
    const filters = descriptor.sections?.[0]?.filters ?? [];
    const bar = filters.find((f) => f.type === 'drawbox');

    expect(bar?.values?.enable).toBe("'gte(t,0.3)'");
  });

  it('honours an authored reveal delay', () => {
    const descriptor = buildDescriptor(
      stateWith([videoWith({ overlays: [overlay({ accent: '#ff8800', reveal: { type: 'fade', delay: 1.2 } })] })])
    );
    const bar = (descriptor.sections?.[0]?.filters ?? []).find((f) => f.type === 'drawbox');

    expect(bar?.values?.enable).toBe("'gte(t,1.2)'");
  });

  it('emits no gate without a reveal or with reveal none (backward compatible)', () => {
    const plain = buildDescriptor(stateWith([videoWith({ overlays: [overlay({ accent: '#ff8800' })] })]));
    const none = buildDescriptor(
      stateWith([videoWith({ overlays: [overlay({ accent: '#ff8800', reveal: 'none' })] })])
    );

    for (const descriptor of [plain, none]) {
      const bar = (descriptor.sections?.[0]?.filters ?? []).find((f) => f.type === 'drawbox');
      expect(bar?.values).not.toHaveProperty('enable');
    }
  });

  it('still round-trips the accent colour with the gate present', () => {
    const state = stateWith([videoWith({ overlays: [overlay({ accent: '#ff8800', reveal: 'rise' })] })]);
    const back = toEditorState(templateFrom(state));
    const section = back.sections[0] as VideoSection;

    expect(section.overlays[0]?.accent).toBe('#ff8800');
    expect(section.overlays[0]?.reveal).toBe('rise');
  });
});
