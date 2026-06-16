// Drives the shared editor model through the same pure ops the new expo builder wizard uses
// (look, grade, motion, framing, layers, per-section audio, transitions, global audio) and asserts
// the descriptor it emits is schema-valid — the expo equivalent of the web panelDescriptor test.
import {
  buildDescriptor,
  newSection,
  patchSection,
  setTransitionAfter,
  patchLayers,
  DEFAULT_AUDIO_MIX,
  type EditorState,
  type EditorSection,
} from '../model/templateEditorModel';
import { newExtraLayer } from './editorPrimitives';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

const baseState = (): EditorState => ({
  id: 'user-parity',
  name: 'Parity template',
  description: '',
  orientation: 'landscape',
  sections: [newSection('video'), newSection('color'), newSection('image')],
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { type: 'cut', duration: 0.5 },
});

const get = <K extends EditorSection['kind']>(state: EditorState, i: number) =>
  state.sections[i] as Extract<EditorSection, { kind: K }>;

describe('expo builder parity → descriptor', () => {
  it('emits a schema-valid descriptor when every panel writes its field', () => {
    let state = baseState();

    // video: look + grade + per-section audio + framing guide + transition after
    state = patchSection(state, 0, {
      look: 'cinematic',
      grade: { contrast: 1.3, saturation: 1.2 },
      musicVolume: 0.4,
      audioFade: { in: { duration: 0.5, curve: 'tri' }, out: { duration: 0.8 } },
      framingGuide: { type: 'silhouette', position: 'center', opacity: 0.4 },
    });
    state = setTransitionAfter(state, 0, { type: 'wipeleft', duration: 0.4 });

    // color: layers + look + transition
    state = patchLayers(state, 1, [{ color: '#000000', opacity: 1 }, newExtraLayer()]);
    state = patchSection(state, 1, { look: 'warm' });
    state = setTransitionAfter(state, 1, { type: 'fade', duration: 0.3 });

    // image: kenburns motion + look (last visual — no transition after it)
    state = patchSection(state, 2, {
      motion: [{ type: 'kenburns', direction: 'in', intensity: 1.2 }],
      look: 'vivid',
    });

    // global audio mix
    state = { ...state, audio: { ...state.audio, normalize: 'loudnorm', ducking: true } };
    state = { ...state, defaultTransition: { type: 'fade', duration: 0.5 } };

    const descriptor = buildDescriptor(state);
    const result = TemplateDescriptorSchema.safeParse(descriptor);

    expect(result.success).toBe(true);
  });

  it('maps each panel field to the right descriptor location', () => {
    let state = baseState();
    state = patchSection(state, 0, {
      look: 'cinematic',
      grade: { contrast: 1.3 },
      framingGuide: { type: 'silhouette', position: 'center', opacity: 0.4 },
      musicVolume: 0.4,
    });
    state = setTransitionAfter(state, 0, { type: 'wipeleft', duration: 0.4 });
    state = patchLayers(state, 1, [{ color: '#000000', opacity: 1 }, newExtraLayer()]);
    state = patchSection(state, 2, { motion: [{ type: 'kenburns', direction: 'in', intensity: 1.2 }] });
    state = { ...state, audio: { ...state.audio, normalize: 'loudnorm', ducking: true } };

    const d = buildDescriptor(state);
    const sections = d.sections ?? [];
    const video = sections[0];
    const color = sections[1];
    const image = sections[2];

    expect(video.transition).toEqual({ type: 'wipeleft', duration: 0.4 });
    expect(video.look).toBe('cinematic');
    expect(video.grade?.contrast).toBe(1.3);
    expect(video.options?.framingGuide).toMatchObject({ type: 'silhouette', position: 'center' });
    expect(video.options?.musicVolume).toBe(0.4);
    expect(color.options?.layers?.length).toBe(2);
    expect(image.motion?.[0]).toMatchObject({ type: 'kenburns', direction: 'in' });
    expect(d.global?.audio).toMatchObject({ normalize: 'loudnorm', ducking: true });
  });

  it('clears a transition (no dangling) when set back to a cut', () => {
    let state = baseState();
    state = setTransitionAfter(state, 0, { type: 'wipeleft', duration: 0.4 });
    state = setTransitionAfter(state, 0, undefined);

    expect(get<'video'>(state, 0).transitionAfter).toBeUndefined();
    expect(buildDescriptor(state).sections?.[0].transition).toBeUndefined();
  });

  it('clears per-section audio when fields are set to undefined (patchSection merge semantics)', () => {
    let state = baseState();
    state = patchSection(state, 0, { musicVolume: 0.3, audioFade: { in: { duration: 0.5 } } });
    state = patchSection(state, 0, { musicVolume: undefined, audioFade: undefined });

    const options = buildDescriptor(state).sections?.[0].options;

    expect(options?.musicVolume).toBeUndefined();
    expect(options?.audioFade).toBeUndefined();
  });
});
