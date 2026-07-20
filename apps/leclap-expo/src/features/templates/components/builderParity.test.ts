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
  globalOverlays: [],
  globalAnimations: [],
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

  it('chromaKey, titleCard and lowerThird land at their descriptor paths', () => {
    let state = baseState();
    state = patchSection(state, 0, { chromaKey: { color: '#00ff00', similarity: 0.2 } });
    state = patchSection(state, 0, { lowerThird: { title: { en: 'Alex' }, position: 'top' } });
    state = patchSection(state, 1, { titleCard: { headline: { en: 'Hello' } } });

    const d = buildDescriptor(state);
    const video = d.sections!.find((s) => s.name === 'video_1') as never as Record<string, unknown>;
    const color = d.sections!.find((s) => s.type === 'color_background') as never as Record<string, unknown>;

    expect((video.chromaKey as Record<string, unknown>).color).toBe('#00ff00');
    expect((video.lowerThird as Record<string, unknown>).position).toBe('top');
    expect(((video.lowerThird as Record<string, unknown>).title as Record<string, unknown>).en).toBe('Alex');
    expect(((color.titleCard as Record<string, unknown>).headline as Record<string, unknown>).en).toBe('Hello');
    expect(TemplateDescriptorSchema.safeParse(d).success).toBe(true);
  });

  it('speed, captureMode and overlay flip land at their descriptor paths', () => {
    let state = baseState();
    state = patchSection(state, 0, {
      speed: 2,
      captureMode: 'back',
      allowedCaptureModes: ['back', 'screen'],
      animations: [{ url: 'library://confetti', flip: 'horizontal' }],
    });

    const d = buildDescriptor(state);
    const video = d.sections!.find((s) => s.name === 'video_1') as never as Record<string, unknown>;
    const options = video.options as Record<string, unknown>;
    const inputs = video.inputs as Array<Record<string, unknown>>;
    const animationInput = inputs.find((i) => i.type === 'animation') as Record<string, unknown>;
    const animationOptions = animationInput.options as Record<string, unknown>;

    expect(options.speed).toBe(2);
    expect(options.captureMode).toBe('back');
    expect(options.allowedCaptureModes).toEqual(['back', 'screen']);
    expect(animationOptions.flip).toBe('horizontal');
    expect(TemplateDescriptorSchema.safeParse(d).success).toBe(true);
  });

  it('letterbox, audioEffect and shake/pulse motion (effects-pack) land at their descriptor paths', () => {
    let state = baseState();
    state = patchSection(state, 0, {
      letterbox: { aspect: 2.39, color: '#111111' },
      audioEffect: 'telephone',
      grade: { grain: 0.4 },
    });
    state = patchSection(state, 1, { letterbox: { aspect: 1.85 } });
    state = patchSection(state, 2, { motion: [{ type: 'shake', intensity: 10, frequency: 3 }] });

    const d = buildDescriptor(state);
    const video = d.sections!.find((s) => s.name === 'video_1') as never as Record<string, unknown>;
    const color = d.sections!.find((s) => s.type === 'color_background') as never as Record<string, unknown>;
    const image = d.sections!.find((s) => s.type === 'image_background') as never as Record<string, unknown>;

    expect(video.letterbox).toEqual({ aspect: 2.39, color: '#111111' });
    expect((video.options as Record<string, unknown>).audioEffect).toBe('telephone');
    expect((video.grade as Record<string, unknown>).grain).toBe(0.4);
    expect(color.letterbox).toEqual({ aspect: 1.85 });
    expect(image.motion).toEqual([{ type: 'shake', intensity: 10, frequency: 3 }]);
    expect(TemplateDescriptorSchema.safeParse(d).success).toBe(true);
  });

  it('global.watermark lands with the right url/position/scale and is schema-valid (library image)', () => {
    let state = baseState();
    state = {
      ...state,
      watermark: {
        image: { source: 'library', id: 'desk-flatlay' },
        position: 'top-left',
        scale: 0.2,
        opacity: 0.6,
        margin: 12,
      },
    };

    const d = buildDescriptor(state);

    expect(d.global?.watermark).toEqual({
      url: 'library://desk-flatlay',
      position: 'top-left',
      scale: 0.2,
      opacity: 0.6,
      margin: 12,
    });
    expect(TemplateDescriptorSchema.safeParse(d).success).toBe(true);
  });

  it('global.watermark lowers a pasted URL image and omits unset presentation fields', () => {
    let state = baseState();
    state = { ...state, watermark: { image: { source: 'url', url: 'https://example.com/logo.png' } } };

    const d = buildDescriptor(state);

    expect(d.global?.watermark).toEqual({ url: 'https://example.com/logo.png' });
    expect(TemplateDescriptorSchema.safeParse(d).success).toBe(true);
  });

  it('omits global.watermark entirely when unset', () => {
    const state = baseState();

    const d = buildDescriptor(state);

    expect(d.global?.watermark).toBeUndefined();
  });

  it('overlay fit is cleared when scale is cleared (stale-fit regression)', () => {
    let state = baseState();
    state = patchSection(state, 0, {
      animations: [{ url: 'library://confetti', scale: '200:200', fit: 'contain' }],
    });

    // Mirrors PlacementFields' scale onChange (sceneFields.tsx): clearing the scale also clears the
    // fit, so a fit picked while a scale box existed never survives into the descriptor once the
    // scale is cleared again.
    state = patchSection(state, 0, {
      animations: [{ url: 'library://confetti', scale: undefined, fit: undefined }],
    });

    const d = buildDescriptor(state);
    const video = d.sections!.find((s) => s.name === 'video_1') as never as Record<string, unknown>;
    const inputs = video.inputs as Array<Record<string, unknown>> | undefined;
    const animationInput = inputs?.find((i) => i.type === 'animation') as Record<string, unknown> | undefined;
    const animationOptions = animationInput?.options as Record<string, unknown> | undefined;

    expect(animationOptions?.fit).toBeUndefined();
  });
});
