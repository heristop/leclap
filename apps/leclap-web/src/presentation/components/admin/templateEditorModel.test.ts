import { describe, it, expect } from 'vitest';
import { buildDescriptor, toEditorState, newSection, DEFAULT_AUDIO_MIX, type EditorState } from './templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

// The editor model itself is exhaustively tested in the core package
// (packages/.../tests/template-editor-model.test.ts). This file only guards the web re-export
// wiring: the shared module resolves through the web import path and produces a valid descriptor.

function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections: [newSection('video')],
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
    globalOverlays: [],
    ...over,
  };
}

describe('web templateEditorModel re-export', () => {
  it('re-exports buildDescriptor producing a schema-valid descriptor', () => {
    const result = TemplateDescriptorSchema.safeParse(buildDescriptor(baseState()));

    expect(result.success).toBe(true);
  });

  it('round-trips the audio mix through the web import path', () => {
    const state = baseState({ audio: { sourceVolume: 0.7, musicVolume: 0.3, ducking: false } });
    const back = toEditorState({
      id: state.id,
      name: state.name,
      description: state.description,
      orientation: state.orientation,
      descriptor: buildDescriptor(state),
    });

    expect(back.audio.sourceVolume).toBeCloseTo(0.7);
    expect(back.audio.musicVolume).toBeCloseTo(0.3);
  });
});
