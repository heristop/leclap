import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  collectVariables,
  newOverlay,
  newSection,
  parseFraction,
  toEditorState,
  duplicateSection,
  setTransitionAfter,
  patchLayers,
  createHistory,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
  type EditableTemplate,
  type TextOverlay,
  type BackgroundLayer,
} from '../src/editor/templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

// Id-agnostic literals — the model never resolves them, so we avoid app media catalogs.
const music1 = 'go-by-ocean';
const music2 = 'americana';
const bg1 = 'forest-sea';
const bg2 = 'golden-hour';

function baseState(input: EditorSection[] | Partial<EditorState> = {}): EditorState {
  const over: Partial<EditorState> = Array.isArray(input) ? { sections: input } : input;

  const defaults: EditorState = {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections: [],
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
  };

  return { ...defaults, ...over };
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

function overlay(over: Partial<TextOverlay> = {}): TextOverlay {
  return { ...newOverlay(), ...over };
}

function videoSection(overlays: TextOverlay[]): EditorSection {
  return { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), overlays };
}

function drawtextFilters(state: EditorState): Array<Record<string, unknown>> {
  const d = buildDescriptor(state);
  const video = d.sections?.find((s) => s.type === 'project_video');

  return (video?.filters ?? []).filter((f) => f.type === 'drawtext').map((f) => f.values as Record<string, unknown>);
}

function drawtextValues(state: EditorState): Record<string, unknown> | undefined {
  return drawtextFilters(state)[0];
}

// --- newSection / newOverlay defaults ---

describe('templateEditorModel — newSection/newOverlay defaults', () => {
  it('creates sensible defaults per kind', () => {
    expect(newSection('video')).toEqual({
      kind: 'video',
      duration: 8,
      mute: false,
      overlays: [],
      countdown: false,
      countdownSeconds: 4,
    });
    expect(newSection('color')).toEqual({ kind: 'color', duration: 3, color: '#7C83FD' });
    expect(newSection('form')).toEqual({
      kind: 'form',
      fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }],
    });
    expect(newSection('music')).toEqual({ kind: 'music', allowed: [], allowUpload: false });
    expect(newSection('image')).toEqual({ kind: 'image', allowed: [], allowUpload: false, duration: 4 });
    expect(newSection('partial')).toEqual({ kind: 'partial', ref: '', variables: [] });
  });

  it('newOverlay() is a centered, white, box-less overlay on the default font', () => {
    expect(newOverlay()).toEqual({
      text: '',
      x: 0.5,
      y: 0.5,
      fontsize: 48,
      fontcolor: '#ffffff',
      font: 'rubik',
      box: false,
      boxcolor: '#000000',
      boxOpacity: 0.5,
    });
  });
});

// --- partial sections ---

describe('templateEditorModel — partial section', () => {
  it('emits a compact partial reference descriptor', () => {
    const descriptor = buildDescriptor(
      baseState([
        {
          kind: 'partial',
          ref: 'local:intro',
          prefix: 'intro_',
          variables: [
            { name: 'title', value: 'Launch' },
            { name: '', value: 'ignored' },
          ],
        },
        newSection('video'),
      ])
    );

    expect(descriptor.sections?.[0]).toEqual({
      name: 'partial_1',
      type: 'partial',
      ref: 'local:intro',
      prefix: 'intro_',
      variables: { title: 'Launch' },
    });
  });

  it('rehydrates partial references instead of dropping them', () => {
    const state = toEditorState({
      id: 'user-1',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: {
        global: { orientation: 'landscape' },
        sections: [
          {
            type: 'partial',
            ref: 'local:intro',
            prefix: 'intro_',
            variables: { title: 'Launch' },
          },
          {
            name: 'video_1',
            type: 'project_video',
            options: { duration: 4 },
          },
        ],
      },
    });

    expect(state.sections[0]).toEqual({
      kind: 'partial',
      ref: 'local:intro',
      prefix: 'intro_',
      variables: [{ name: 'title', value: 'Launch' }],
    });
    expect(state.sections[1].kind).toBe('video');
  });
});

// --- music section ---

describe('templateEditorModel — music section', () => {
  it('folds a music section into global.musicEnabled/allowedMusic/allowUploadMusic', () => {
    const d = buildDescriptor(
      baseState([newSection('video'), { kind: 'music', allowed: [music1, music2], allowUpload: true }])
    );

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1, music2]);
    expect(d.global?.allowUploadMusic).toBe(true);
    expect(d.sections?.some((s) => s.type === 'music')).toBe(false);
  });

  it('emits allowUploadMusic:false when uploads are not allowed', () => {
    const d = buildDescriptor(baseState([{ kind: 'music', allowed: [music1], allowUpload: false }]));

    expect(d.global?.allowUploadMusic).toBe(false);
  });

  it('leaves music globals off (musicEnabled:false) when there is no music section', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.global?.musicEnabled).toBe(false);
    expect(d.global?.allowedMusic).toBeUndefined();
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });

  it('treats an upload-only music section (no shortlist) as enabled', () => {
    const d = buildDescriptor(baseState([{ kind: 'music', allowed: [], allowUpload: true }]));

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([]);
    expect(d.global?.allowUploadMusic).toBe(true);
  });
});

// --- image section ---

describe('templateEditorModel — image section', () => {
  it('emits an image_background descriptor section with its duration + background globals', () => {
    const d = buildDescriptor(baseState([{ kind: 'image', allowed: [bg1, bg2], allowUpload: true, duration: 6 }]));

    const imageSection = d.sections?.find((s) => s.type === 'image_background');

    expect(imageSection).toMatchObject({ name: 'image_1', type: 'image_background', options: { duration: 6 } });
    expect((imageSection?.options as { pictureUrl?: string } | undefined)?.pictureUrl).toBeUndefined();
    expect(d.global?.allowedBackgrounds).toEqual([bg1, bg2]);
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('numbers multiple image sections image_1, image_2 and de-duplicates the global union', () => {
    const d = buildDescriptor(
      baseState([
        { kind: 'image', allowed: [bg1], allowUpload: false, duration: 4 },
        { kind: 'image', allowed: [bg1, bg2], allowUpload: true, duration: 5 },
      ])
    );

    const imageSections = (d.sections ?? []).filter((s) => s.type === 'image_background');

    expect(imageSections.map((s) => s.name)).toEqual(['image_1', 'image_2']);
    expect(imageSections.map((s) => s.options?.duration)).toEqual([4, 5]);
    expect(d.global?.allowedBackgrounds).toEqual([bg1, bg2]);
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('leaves background globals off and emits no image_background when there is no image section', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});

// --- form/video/color numbering ---

describe('templateEditorModel — form/video/color', () => {
  it('maps form/video/color sections to a descriptor and numbers videos independently', () => {
    const descriptor = buildDescriptor(
      baseState([newSection('form'), videoSection([]), newSection('color'), videoSection([])])
    );

    const sections = descriptor.sections ?? [];
    expect(sections.map((s) => s.type)).toEqual(['form', 'project_video', 'color_background', 'project_video']);
    expect(sections[1].name).toBe('video_1');
    expect(sections[3].name).toBe('video_2');
    expect(sections[0].options?.fields).toEqual([{ name: 'firstname', maxLength: 40, label: { en: 'Your name' } }]);
    expect(sections[2].options).toEqual({ duration: 3, backgroundColor: '#7C83FD' });
  });
});

// --- video overlays → drawtext filters ---

describe('templateEditorModel — video overlays → drawtext filters', () => {
  it('writes the centered fractions into drawtext x/y at the default position', () => {
    const values = drawtextValues(baseState([videoSection([overlay({ text: 'Hello' })])]));

    expect(values?.x).toBe('(w-text_w)*0.5');
    expect(values?.y).toBe('(h-text_h)*0.5');
  });

  it('feeds custom x/y and font styling into the drawtext values', () => {
    const o = overlay({ text: 'Hello', x: 0.25, y: 0.8, fontsize: 64, fontcolor: '#ff0000' });
    const values = drawtextValues(baseState([videoSection([o])]));

    expect(values).toMatchObject({
      text: { en: 'Hello' },
      fontsize: 64,
      fontcolor: '#ff0000',
      fontfile: 'Rubik.ttf',
      x: '(w-text_w)*0.25',
      y: '(h-text_h)*0.8',
    });
  });

  it('rounds the fractions to 3 decimals and clamps them to [0, 1]', () => {
    const values = drawtextValues(baseState([videoSection([overlay({ text: 'Hi', x: 0.123456, y: 1.5 })])]));

    expect(values?.x).toBe('(w-text_w)*0.123');
    expect(values?.y).toBe('(h-text_h)*1');
  });

  it('emits box/boxcolor/boxborderw only when the overlay opts into a box', () => {
    const boxed = drawtextValues(
      baseState([videoSection([overlay({ text: 'Boxed', box: true, boxcolor: '#112233' })])])
    );

    expect(boxed).toMatchObject({ box: 1, boxcolor: '#112233@0.5', boxborderw: 12 });

    const plain = drawtextValues(baseState([videoSection([overlay({ text: 'Plain', box: false })])]));

    expect(plain).not.toHaveProperty('box');
    expect(plain).not.toHaveProperty('boxcolor');
  });

  it('emits one drawtext filter per non-empty overlay, in order, skipping blanks', () => {
    const filters = drawtextFilters(
      baseState([videoSection([overlay({ text: 'Keep' }), overlay({ text: '   ' }), overlay({ text: 'Me' })])])
    );

    expect(filters).toHaveLength(2);
    expect(filters.map((f) => (f.text as { en: string }).en)).toEqual(['Keep', 'Me']);
  });

  it('emits no filters when there are no overlays or all are empty', () => {
    const none = buildDescriptor(baseState([videoSection([])]));

    expect(none.sections?.find((s) => s.type === 'project_video')?.filters).toBeUndefined();

    const allEmpty = buildDescriptor(baseState([videoSection([overlay({ text: '' }), overlay({ text: '  ' })])]));

    expect(allEmpty.sections?.find((s) => s.type === 'project_video')?.filters).toBeUndefined();
  });
});

// --- per-overlay font + global variables ---

describe('templateEditorModel — per-overlay font + global variables', () => {
  it('emits the chosen fontfile per overlay', () => {
    const d = buildDescriptor(baseState([videoSection([overlay({ text: 'Hi', font: 'oswald' })])]));

    expect((d.sections?.find((s) => s.type === 'project_video')?.filters ?? [])[0].values?.fontfile).toBe('Oswald.ttf');
  });

  it('writes author global variables into global.variables', () => {
    const d = buildDescriptor(baseState({ globalVariables: [{ name: 'brand', value: 'LeClap' }] }));

    expect(d.global?.variables?.brand).toBe('LeClap');
  });

  it('collectVariables unions form fields and global vars', () => {
    const s = baseState({
      globalVariables: [{ name: 'brand', value: 'X' }],
      sections: [{ kind: 'form', fields: [{ name: 'firstname', label: 'First', maxLength: 40 }] }],
    });

    expect(collectVariables(s)).toEqual(expect.arrayContaining(['firstname', 'brand']));
  });
});

// --- parseFraction ---

describe('templateEditorModel — parseFraction', () => {
  it('extracts the multiplier from a (w-text_w)*<frac> expression', () => {
    expect(parseFraction('(w-text_w)*0.25')).toBe(0.25);
    expect(parseFraction('(h-text_h)*0.8')).toBe(0.8);
  });

  it('defaults to 0.5 for the legacy centered /2 form and unparseable values', () => {
    expect(parseFraction('(w-text_w)/2')).toBe(0.5);
    expect(parseFraction()).toBe(0.5);
    expect(parseFraction(120)).toBe(0.5);
    expect(parseFraction('center')).toBe(0.5);
  });

  it('clamps parsed fractions to [0, 1]', () => {
    expect(parseFraction('(w-text_w)*1.5')).toBe(1);
    expect(parseFraction('(w-text_w)*0')).toBe(0);
  });
});

// --- round-trips ---

describe('templateEditorModel — round-trips', () => {
  it('round-trips multiple overlays (text, position, font, box) through a stored template', () => {
    const overlays = [
      overlay({ text: 'Title', x: 0.25, y: 0.75, fontsize: 64, fontcolor: '#ff0000' }),
      overlay({ text: 'Subtitle', x: 0.5, y: 0.9, box: true, boxcolor: '#102030' }),
    ];
    const back = toEditorState(asTemplate(baseState([videoSection(overlays)])));
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays).toEqual(overlays);
  });

  it('round-trips box opacity and font', () => {
    const o = overlay({ text: 'Hi', box: true, boxcolor: '#000000', boxOpacity: 0.3, font: 'pacifico' });
    const back = toEditorState(asTemplate(baseState([videoSection([o])])));
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays[0].boxOpacity).toBeCloseTo(0.3);
    expect(video.overlays[0].font).toBe('pacifico');
  });

  it('round-trips a music section, surfaced at the top', () => {
    const start = baseState([newSection('video'), { kind: 'music', allowed: [music1, music2], allowUpload: true }]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections.find((s) => s.kind === 'music')).toEqual({
      kind: 'music',
      allowed: [music1, music2],
      allowUpload: true,
    });
    expect(back.sections[0].kind).toBe('music');
  });

  it('round-trips an image section (descriptor section + duration + globals)', () => {
    const start = baseState([{ kind: 'image', allowed: [bg1, bg2], allowUpload: true, duration: 7 }]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections.find((s) => s.kind === 'image')).toEqual({
      kind: 'image',
      allowed: [bg1, bg2],
      allowUpload: true,
      duration: 7,
    });
  });

  it('reconstructs image sections at their descriptor position, music at the top', () => {
    const start = baseState([
      newSection('video'),
      { kind: 'image', allowed: [bg1], allowUpload: false, duration: 4 },
      { kind: 'music', allowed: [music1], allowUpload: false },
    ]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections.map((s) => s.kind)).toEqual(['music', 'video', 'image']);
  });

  it('toEditorState returns a single blank video section for a null template', () => {
    const state = toEditorState(null);

    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].kind).toBe('video');
    expect(state.audio).toEqual(DEFAULT_AUDIO_MIX);
    expect(state.defaultTransition).toEqual(DEFAULT_TRANSITION);
  });
});

// --- transitions/look/grade/motion/layers/framingGuide fields ---

describe('templateEditorModel — transitions/look/grade/motion/layers fields', () => {
  it('maps audio (sourceVolume/musicVolume/normalize/ducking) to global.audio', () => {
    const d = buildDescriptor(
      baseState({ audio: { sourceVolume: 0.7, musicVolume: 0.3, normalize: 'loudnorm', ducking: true } })
    );

    expect(d.global?.audio).toEqual({ sourceVolume: 0.7, musicVolume: 0.3, normalize: 'loudnorm', ducking: true });
  });

  it('omits normalize and ducking from global.audio when unset/disabled', () => {
    const d = buildDescriptor(baseState({ audio: { sourceVolume: 1, musicVolume: 0.5, ducking: false } }));

    expect(d.global?.audio).toEqual({ sourceVolume: 1, musicVolume: 0.5 });
  });

  it('round-trips the audio mix including normalize/ducking', () => {
    const state = baseState({ audio: { sourceVolume: 0.6, musicVolume: 0.2, normalize: 'dynaudnorm', ducking: true } });
    const back = toEditorState(asTemplate(state));

    expect(back.audio).toEqual({ sourceVolume: 0.6, musicVolume: 0.2, normalize: 'dynaudnorm', ducking: true });
  });

  it('maps defaultTransition to global.transition and back', () => {
    const state = baseState({ defaultTransition: { type: 'fade', duration: 0.8 } });
    const d = buildDescriptor(state);

    expect(d.global?.transition).toEqual({ type: 'fade', duration: 0.8 });
    expect(toEditorState(asTemplate(state)).defaultTransition).toEqual({ type: 'fade', duration: 0.8 });
  });

  it('passes section transitionAfter through as section.transition and back', () => {
    const state = baseState([
      {
        ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
        transitionAfter: { type: 'wipeleft', duration: 0.4 },
      },
    ]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].transition).toEqual({ type: 'wipeleft', duration: 0.4 });
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'color');

    expect((back as Extract<EditorSection, { kind: 'color' }>).transitionAfter).toEqual({
      type: 'wipeleft',
      duration: 0.4,
    });
  });

  it('passes look/grade/motion through on visual sections and back', () => {
    const motion = [{ type: 'kenburns' as const, direction: 'in' as const, intensity: 1.2 }];
    const grade = { brightness: 0.1, contrast: 1.2 };
    const state = baseState([
      {
        ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
        look: 'cinematic',
        grade,
        motion,
      },
    ]);
    const d = buildDescriptor(state);
    const section = d.sections?.[0];

    expect(section?.look).toBe('cinematic');
    expect(section?.grade).toEqual(grade);
    expect(section?.motion).toEqual(motion);

    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'video') as Extract<
      EditorSection,
      { kind: 'video' }
    >;

    expect(back.look).toBe('cinematic');
    expect(back.grade).toEqual(grade);
    expect(back.motion).toEqual(motion);
  });

  it('passes color-section layers through as options.layers and back', () => {
    const layers: BackgroundLayer[] = [{ gradient: { from: '#000', to: '#fff', direction: 'vertical' }, opacity: 0.8 }];
    const state = baseState([{ ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>), layers }]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].options?.layers).toEqual(layers);
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'color') as Extract<
      EditorSection,
      { kind: 'color' }
    >;

    expect(back.layers).toEqual(layers);
  });

  it('passes a project_video framingGuide through and back', () => {
    const framingGuide = { type: 'silhouette' as const, position: 'center' as const, opacity: 0.4 };
    const state = baseState([{ ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), framingGuide }]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].options?.framingGuide).toEqual(framingGuide);
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'video') as Extract<
      EditorSection,
      { kind: 'video' }
    >;

    expect(back.framingGuide).toEqual(framingGuide);
  });

  it('passes a project_video framingGuide style through and back', () => {
    const framingGuide = {
      type: 'silhouette' as const,
      position: 'right' as const,
      opacity: 0.45,
      style: 'outline' as const,
    };
    const state = baseState([{ ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), framingGuide }]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].options?.framingGuide).toEqual(framingGuide);
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'video') as Extract<
      EditorSection,
      { kind: 'video' }
    >;

    expect(back.framingGuide).toEqual(framingGuide);
  });
});

// --- "what to film" description ---

describe('templateEditorModel — video description', () => {
  const videoWith = (over: Partial<Extract<EditorSection, { kind: 'video' }>>): EditorSection => ({
    ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
    ...over,
  });

  const videoSectionOf = (state: EditorState) =>
    buildDescriptor(state).sections?.find((s) => s.type === 'project_video');

  it('emits section.description = { en } when set', () => {
    const section = videoSectionOf(baseState([videoWith({ description: 'Say your name' })]));

    expect(section?.description).toEqual({ en: 'Say your name' });
  });

  it('omits description for an empty or whitespace-only value', () => {
    expect(videoSectionOf(baseState([videoWith({ description: '' })]))?.description).toBeUndefined();
    expect(videoSectionOf(baseState([videoWith({ description: '   ' })]))?.description).toBeUndefined();
    expect(videoSectionOf(baseState([newSection('video')]))?.description).toBeUndefined();
  });

  it('round-trips a description through a stored template', () => {
    const back = toEditorState(asTemplate(baseState([videoWith({ description: 'Look at the camera' })]))).sections.find(
      (s) => s.kind === 'video'
    );

    expect(back).toMatchObject({ description: 'Look at the camera' });
  });

  it('reads back the first locale when en is absent', () => {
    const template: EditableTemplate = {
      id: 'user-1',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: { sections: [{ name: 'video_1', type: 'project_video', description: { fr: 'Souris' } }] },
    };
    const back = toEditorState(template).sections.find((s) => s.kind === 'video');

    expect(back).toMatchObject({ description: 'Souris' });
  });

  it('leaves description unset when the stored section has none', () => {
    const back = toEditorState(asTemplate(baseState([newSection('video')]))).sections.find((s) => s.kind === 'video');

    expect(back).not.toHaveProperty('description');
  });
});

// --- pure ops: duplicateSection / setTransitionAfter / patchLayers ---

describe('templateEditorModel — pure ops', () => {
  it('duplicateSection deep-copies the section and inserts the copy after it', () => {
    const state = baseState([videoSection([overlay({ text: 'Title' })]), newSection('color')]);
    const next = duplicateSection(state, 0);

    expect(next.sections).toHaveLength(3);
    expect(next.sections.map((s) => s.kind)).toEqual(['video', 'video', 'color']);

    const original = next.sections[0] as Extract<EditorSection, { kind: 'video' }>;
    const copy = next.sections[1] as Extract<EditorSection, { kind: 'video' }>;

    expect(original.overlays[0].text).toBe('Title');
    expect(copy.overlays[0].text).toBe('Title copy');
    // deep copy: mutating the copy does not touch the original
    expect(copy.overlays).not.toBe(original.overlays);
  });

  it('duplicateSection is a no-op for an out-of-range index', () => {
    const state = baseState([newSection('video')]);

    expect(duplicateSection(state, 5).sections).toHaveLength(1);
  });

  it('setTransitionAfter sets and clears a visual section transition', () => {
    const state = baseState([newSection('color')]);
    const withT = setTransitionAfter(state, 0, { type: 'fade', duration: 0.5 });

    expect((withT.sections[0] as Extract<EditorSection, { kind: 'color' }>).transitionAfter).toEqual({
      type: 'fade',
      duration: 0.5,
    });

    const cleared = setTransitionAfter(withT, 0, undefined);

    expect((cleared.sections[0] as Extract<EditorSection, { kind: 'color' }>).transitionAfter).toBeUndefined();
  });

  it('setTransitionAfter is a no-op on a music section', () => {
    const state = baseState([{ kind: 'music', allowed: [], allowUpload: false }]);

    expect(setTransitionAfter(state, 0, { type: 'fade' })).toBe(state);
  });

  it('patchLayers replaces layers on a color section only', () => {
    const layers: BackgroundLayer[] = [{ color: '#ff0000', opacity: 0.5 }];
    const state = baseState([newSection('color'), newSection('video')]);
    const next = patchLayers(state, 0, layers);

    expect((next.sections[0] as Extract<EditorSection, { kind: 'color' }>).layers).toEqual(layers);
    // non-color is untouched
    expect(patchLayers(state, 1, layers)).toBe(state);
  });
});

// --- history undo/redo ---

describe('templateEditorModel — createHistory', () => {
  it('starts with the initial state and no undo/redo available', () => {
    const h = createHistory(baseState([newSection('video')]));

    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.state.sections).toHaveLength(1);
  });

  it('set/undo/redo move through the history', () => {
    const h = createHistory(baseState([newSection('video')]));
    const next = addOne(h.state);

    h.set(next);
    expect(h.state.sections).toHaveLength(2);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);

    h.undo();
    expect(h.state.sections).toHaveLength(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);

    h.redo();
    expect(h.state.sections).toHaveLength(2);
    expect(h.canRedo).toBe(false);
  });

  it('set clears the redo (future) stack', () => {
    const h = createHistory(baseState([newSection('video')]));

    h.set(addOne(h.state));
    h.undo();
    expect(h.canRedo).toBe(true);

    h.set(addOne(h.state));
    expect(h.canRedo).toBe(false);
  });

  it('bounds the undo stack at 50 entries', () => {
    const h = createHistory(baseState([newSection('video')]));

    for (let i = 0; i < 60; i += 1) {
      h.set(addOne(h.state));
    }

    // 60 sets recorded, but only the last 50 are undoable
    let undos = 0;
    while (h.canUndo) {
      h.undo();
      undos += 1;
    }

    expect(undos).toBe(50);
  });
});

function addOne(state: EditorState): EditorState {
  return { ...state, sections: [...state.sections, newSection('video')] };
}

// --- core schema validation guard ---

describe('templateEditorModel — core schema validation guard', () => {
  it('buildDescriptor(defaultState) passes core schema validation', () => {
    const result = TemplateDescriptorSchema.safeParse(buildDescriptor(baseState([newSection('video')])));

    expect(result.success).toBe(true);
  });

  it('a descriptor with all the structured fields passes core schema validation', () => {
    const state = baseState({
      audio: { sourceVolume: 0.7, musicVolume: 0.3, normalize: 'loudnorm', ducking: true },
      defaultTransition: { type: 'fade', duration: 0.6 },
      sections: [
        {
          ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
          overlays: [overlay({ text: 'Hi' })],
          look: 'cinematic',
          grade: { brightness: 0.1 },
          motion: [{ type: 'kenburns', direction: 'in' }],
          framingGuide: { type: 'silhouette', position: 'center' },
          transitionAfter: { type: 'fade', duration: 0.4 },
        },
        {
          ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
          layers: [{ gradient: { from: '#000', to: '#fff' } }],
        },
      ],
    });

    const result = TemplateDescriptorSchema.safeParse(buildDescriptor(state));

    expect(result.success).toBe(true);
  });
});

// --- per-section musicVolume + audioFade ---

describe('templateEditorModel — per-section musicVolume + audioFade', () => {
  it('emits options.musicVolume on a video section when set', () => {
    const state = baseState([
      {
        ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
        musicVolume: 0.3,
      },
    ]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].options?.musicVolume).toBe(0.3);
  });

  it('omits options.musicVolume when not set', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.sections?.[0].options?.musicVolume).toBeUndefined();
  });

  it('emits options.audioFade with in + out + curve on a video section', () => {
    const audioFade = {
      in: { duration: 0.5, curve: 'qsin' as const },
      out: { duration: 1.0, curve: 'exp' as const },
    };
    const state = baseState([
      {
        ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
        audioFade,
      },
    ]);
    const d = buildDescriptor(state);

    expect(d.sections?.[0].options?.audioFade).toEqual(audioFade);
  });

  it('emits options.musicVolume + audioFade on a color section', () => {
    const audioFade = { in: { duration: 0.4 } };
    const state = baseState([
      {
        ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
        musicVolume: 0.8,
        audioFade,
      },
    ]);
    const d = buildDescriptor(state);
    const opts = d.sections?.[0].options;

    expect(opts?.musicVolume).toBe(0.8);
    expect(opts?.audioFade).toEqual(audioFade);
  });

  it('emits options.musicVolume + audioFade on an image section', () => {
    const audioFade = { out: { duration: 0.6, curve: 'tri' as const } };
    const state = baseState([
      {
        ...(newSection('image') as Extract<EditorSection, { kind: 'image' }>),
        musicVolume: 0.2,
        audioFade,
      },
    ]);
    const d = buildDescriptor(state);
    const opts = d.sections?.[0].options;

    expect(opts?.musicVolume).toBe(0.2);
    expect(opts?.audioFade).toEqual(audioFade);
  });

  it('round-trips musicVolume + audioFade {in,out,curve} through a stored template', () => {
    const audioFade = {
      in: { duration: 0.5, curve: 'qsin' as const },
      out: { duration: 1.2, curve: 'hsin' as const },
    };
    const state = baseState([
      {
        ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
        musicVolume: 0.6,
        audioFade,
      },
    ]);
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'video') as Extract<
      EditorSection,
      { kind: 'video' }
    >;

    expect(back.musicVolume).toBe(0.6);
    expect(back.audioFade).toEqual(audioFade);
  });

  it('round-trips audioFade with only an out side (no in)', () => {
    const audioFade = { out: { duration: 0.8 } };
    const state = baseState([
      {
        ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
        audioFade,
      },
    ]);
    const back = toEditorState(asTemplate(state)).sections.find((s) => s.kind === 'color') as Extract<
      EditorSection,
      { kind: 'color' }
    >;

    expect(back.audioFade).toEqual(audioFade);
    expect(back.musicVolume).toBeUndefined();
  });

  it('TemplateDescriptorSchema.safeParse passes with musicVolume + audioFade on video/color/image', () => {
    const state = baseState({
      sections: [
        {
          ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
          musicVolume: 0.4,
          audioFade: { in: { duration: 0.5, curve: 'qsin' as const }, out: { duration: 0.5 } },
        },
        {
          ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
          musicVolume: 0.9,
          audioFade: { out: { duration: 1.0, curve: 'exp' as const } },
        },
        {
          ...(newSection('image') as Extract<EditorSection, { kind: 'image' }>),
          musicVolume: 0.0,
          audioFade: { in: { duration: 0.3 } },
        },
      ],
    });
    const result = TemplateDescriptorSchema.safeParse(buildDescriptor(state));

    expect(result.success).toBe(true);
  });
});

// --- pre-record countdown ---

describe('templateEditorModel — countdown', () => {
  const videoWithCountdown = (countdownSeconds: number): EditorSection => ({
    ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
    countdown: true,
    countdownSeconds,
  });

  const projectVideoOptions = (state: EditorState) =>
    buildDescriptor(state).sections?.find((s) => s.type === 'project_video')?.options;

  it('emits countdown + countdownDuration only when the countdown is enabled', () => {
    const options = projectVideoOptions(baseState([videoWithCountdown(5)]));

    expect(options?.countdown).toBe(true);
    expect(options?.countdownDuration).toBe(5);
  });

  it('omits countdown keys when the countdown is disabled', () => {
    const options = projectVideoOptions(baseState([newSection('video')]));

    expect(options?.countdown).toBeUndefined();
    expect(options?.countdownDuration).toBeUndefined();
  });

  it('round-trips an enabled countdown through a stored template', () => {
    const back = toEditorState(asTemplate(baseState([videoWithCountdown(6)]))).sections.find((s) => s.kind === 'video');

    expect(back).toMatchObject({ countdown: true, countdownSeconds: 6 });
  });

  it('rehydrates countdownSeconds to 4 when countdown is set without a duration', () => {
    const template: EditableTemplate = {
      id: 'user-1',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: { sections: [{ name: 'video_1', type: 'project_video', options: { countdown: true } }] },
    };
    const back = toEditorState(template).sections.find((s) => s.kind === 'video');

    expect(back).toMatchObject({ countdown: true, countdownSeconds: 4 });
  });
});
