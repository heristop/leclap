// Colour fields are plain strings end-to-end, so a '{{ variable }}' token authored in a colour
// field must survive buildDescriptor -> schema validation -> toEditorState untouched — the engine's
// FormatterManager.formatColor resolves it at compile time.
import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  newOverlay,
  newSection,
  toEditorState,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditableTemplate,
  type EditorSection,
  type EditorState,
} from '../src/editor/templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;
type ColorSection = Extract<EditorSection, { kind: 'color' }>;

function tokenState(): EditorState {
  const video = newSection('video') as VideoSection;
  video.overlays = [{ ...newOverlay(), text: 'Hi', fontcolor: '{{ brand }}', box: true, boxcolor: '{{ brand }}' }];

  const color = newSection('color') as ColorSection;
  color.color = '{{ brand }}';

  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections: [video, color],
    globalVariables: [{ name: 'brand', value: '#ff0044' }],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
    globalAnimations: [],
    globalOverlays: [],
  };
}

function asTemplate(state: EditorState): EditableTemplate {
  return {
    id: state.id,
    name: state.name,
    description: state.description,
    orientation: state.orientation,
    descriptor: buildDescriptor(state),
  };
}

describe('variable colour tokens round-trip', () => {
  it('emits the tokens verbatim and the descriptor still validates against the schema', () => {
    const descriptor = buildDescriptor(tokenState());

    expect(() => TemplateDescriptorSchema.parse(descriptor)).not.toThrow();

    const video = descriptor.sections?.find((s) => s.type === 'project_video');
    const drawtext = (video?.filters ?? []).find((f) => f.type === 'drawtext')?.values as Record<string, unknown>;

    expect(drawtext.fontcolor).toBe('{{ brand }}');
    expect(drawtext.boxcolor).toContain('{{ brand }}');

    const colorSection = descriptor.sections?.find((s) => s.type === 'color_background');

    expect(colorSection?.options?.backgroundColor).toBe('{{ brand }}');
    expect(descriptor.global?.variables?.brand).toBe('#ff0044');
  });

  it('re-hydrates the editor with the tokens and the variable intact', () => {
    const back = toEditorState(asTemplate(tokenState()));

    const video = back.sections.find((s) => s.kind === 'video') as VideoSection;

    expect(video.overlays[0].fontcolor).toBe('{{ brand }}');
    expect(video.overlays[0].boxcolor).toBe('{{ brand }}');

    const color = back.sections.find((s) => s.kind === 'color') as ColorSection;

    expect(color.color).toBe('{{ brand }}');
    expect(back.globalVariables).toEqual([{ name: 'brand', value: '#ff0044' }]);
  });
});
