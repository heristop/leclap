import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import {
  buildDescriptor,
  setTransitionAfter,
  patchLayers,
  patchSection,
  DEFAULT_AUDIO_MIX,
  type EditorState,
} from '../templateEditorModel';
import { newExtraLayer } from './layerGeometry';
import { pruneGrade } from './lookFilters';

// A state mirroring what the editor panels write: a video section with a look/grade/motion/
// framing guide + a boundary transition into a layered color section, plus the full audio
// mix. This is the descriptor the panels would produce on save — it must validate.
function panelDrivenState(): EditorState {
  let state: EditorState = {
    id: 'user-panels',
    name: 'Panels',
    description: '',
    orientation: 'portrait',
    sections: [
      {
        kind: 'video',
        duration: 6,
        mute: false,
        overlays: [],
        countdown: false,
        countdownSeconds: 4,
        look: 'cinematic',
        grade: pruneGrade({ contrast: 1.3, saturation: 1.2, brightness: 0 }),
        motion: [{ type: 'kenburns', direction: 'in', intensity: 1.2 }],
        framingGuide: { type: 'silhouette', position: 'center', opacity: 0.4 },
      },
      { kind: 'color', duration: 3, color: '#7C83FD', overlays: [] },
    ],
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX, normalize: 'loudnorm', ducking: true },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
  };

  // TransitionPicker → setTransitionAfter on the video section (it has a visual section after it).
  state = setTransitionAfter(state, 0, { type: 'wipeleft', duration: 0.4 });
  // LayersEditor → patchLayers on the color section.
  state = patchLayers(state, 1, [{ color: '#000000', opacity: 1 }, newExtraLayer()]);
  // LookGallery/GradePanel on the color section.
  state = patchSection(state, 1, { look: 'warm' });

  return state;
}

describe('editor panels → buildDescriptor', () => {
  it('produces a schema-valid descriptor carrying every panel field', () => {
    const descriptor = buildDescriptor(panelDrivenState());
    const result = TemplateDescriptorSchema.safeParse(descriptor);

    expect(result.success).toBe(true);
  });

  it('emits the boundary transition, look, grade, motion, framing guide, layers and audio', () => {
    const descriptor = buildDescriptor(panelDrivenState());
    const [video, color] = descriptor.sections ?? [];

    expect(video.transition).toEqual({ type: 'wipeleft', duration: 0.4 });
    expect(video.look).toBe('cinematic');
    expect(video.grade?.contrast).toBe(1.3);
    expect(video.motion?.[0]).toMatchObject({ type: 'kenburns', direction: 'in' });
    expect(video.options?.framingGuide).toMatchObject({ type: 'silhouette', position: 'center' });
    expect(color.options?.layers).toHaveLength(2);
    expect(color.look).toBe('warm');
    expect(descriptor.global?.audio).toMatchObject({ normalize: 'loudnorm', ducking: true });
  });

  it('clearing the transition removes it from the descriptor (no dangling transition)', () => {
    const cleared = setTransitionAfter(panelDrivenState(), 0, undefined);
    const descriptor = buildDescriptor(cleared);

    expect(descriptor.sections?.[0].transition).toBeUndefined();
    expect(TemplateDescriptorSchema.safeParse(descriptor).success).toBe(true);
  });
});
