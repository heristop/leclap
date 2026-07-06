// The template palette (EditorState.colorsList) must survive the full round-trip: buildDescriptor
// emits it BOTH as global.colorsList (the schema's user-facing palette field, read by the apps'
// template screens) and as global.variables.colorsList (the engine location FormatterManager's
// formatColor reads to resolve '{{ colorN }}' tokens); toEditorState hydrates it back from either.
import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  newSection,
  toEditorState,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditableTemplate,
  type EditorState,
  type TemplateDescriptor,
} from '../src/editor/templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

const PALETTE = ['#292524', '#fafaf9', '#7C83FD'];

function paletteState(): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections: [newSection('video')],
    globalVariables: [{ name: 'brand', value: '#ff0044' }],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
    globalAnimations: [],
    globalOverlays: [],
    colorsList: PALETTE,
  };
}

function asTemplate(descriptor: TemplateDescriptor): EditableTemplate {
  return { id: 'user-1', name: 'T', description: '', orientation: 'landscape', descriptor };
}

describe('colorsList palette round-trip', () => {
  it('emits the palette to global.colorsList AND global.variables.colorsList, and validates', () => {
    const descriptor = buildDescriptor(paletteState());

    expect(() => TemplateDescriptorSchema.parse(descriptor)).not.toThrow();
    expect(descriptor.global?.colorsList).toEqual(PALETTE);
    expect(descriptor.global?.variables?.colorsList).toEqual(PALETTE);
    // The author's own variables still ride alongside the palette.
    expect(descriptor.global?.variables?.brand).toBe('#ff0044');
  });

  it('emits nothing when the palette is empty or absent', () => {
    const empty = buildDescriptor({ ...paletteState(), colorsList: [] });

    expect(empty.global?.colorsList).toBeUndefined();
    expect(empty.global?.variables?.colorsList).toBeUndefined();

    const absent = paletteState();
    delete absent.colorsList;
    const descriptor = buildDescriptor(absent);

    expect(descriptor.global?.colorsList).toBeUndefined();
    expect(descriptor.global?.variables?.colorsList).toBeUndefined();
  });

  it('drops blank swatch rows the builder leaves behind', () => {
    const descriptor = buildDescriptor({ ...paletteState(), colorsList: ['#292524', '', '  '] });

    expect(descriptor.global?.colorsList).toEqual(['#292524']);
    expect(descriptor.global?.variables?.colorsList).toEqual(['#292524']);
  });

  it('re-hydrates the palette without polluting the variable rows', () => {
    const back = toEditorState(asTemplate(buildDescriptor(paletteState())));

    expect(back.colorsList).toEqual(PALETTE);
    // The string[] palette entry stays OUT of the editable name/value variable rows.
    expect(back.globalVariables).toEqual([{ name: 'brand', value: '#ff0044' }]);
  });

  it('re-hydrates a legacy descriptor that only carries global.variables.colorsList', () => {
    const legacy: TemplateDescriptor = {
      global: { variables: { colorsList: PALETTE } },
      sections: [],
    };

    expect(toEditorState(asTemplate(legacy)).colorsList).toEqual(PALETTE);
  });

  it('stays absent on a descriptor without a palette', () => {
    const state = paletteState();
    delete state.colorsList;

    expect(toEditorState(asTemplate(buildDescriptor(state))).colorsList).toBeUndefined();
  });
});
