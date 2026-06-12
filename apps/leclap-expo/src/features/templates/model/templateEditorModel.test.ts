import {
  buildDescriptor,
  newSection,
  toEditorState,
  type EditorState,
  type EditorSection,
  type EditableTemplate,
} from './templateEditorModel';

// Literal catalog ids — the model is id-agnostic, so we avoid importing mediaCatalog
// (it eagerly require()s binary mp3/image assets that ts-jest cannot transform).
const music1 = { id: 'go-by-ocean' };
const music2 = { id: 'americana' };
const bg1 = { id: 'forest-sea' };
const bg2 = { id: 'golden-hour' };

const baseState = (sections: EditorSection[], over: Partial<EditorState> = {}): EditorState => ({
  id: 'user-test',
  name: 'My template',
  description: 'desc',
  orientation: 'landscape',
  sections,
  audioMix: { video: 1, music: 0.5 },
  ...over,
});

const asTemplate = (state: EditorState): EditableTemplate => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

describe('newSection', () => {
  it('creates sensible defaults per kind', () => {
    expect(newSection('video')).toEqual({
      kind: 'video',
      duration: 8,
      mute: false,
      text: '',
      fontsize: 48,
      fontcolor: '#ffffff',
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
  });
});

describe('buildDescriptor — form/video/color', () => {
  it('maps form/video/color sections to a descriptor and numbers videos independently', () => {
    const descriptor = buildDescriptor(
      baseState([
        newSection('form'),
        {
          kind: 'video',
          duration: 6,
          mute: true,
          text: 'Hi {{ firstname }}',
          fontsize: 50,
          fontcolor: '#000000',
          countdown: false,
          countdownSeconds: 4,
        },
        newSection('color'),
        {
          kind: 'video',
          duration: 4,
          mute: false,
          text: '',
          fontsize: 48,
          fontcolor: '#ffffff',
          countdown: false,
          countdownSeconds: 4,
        },
      ])
    );

    const sections = descriptor.sections ?? [];
    expect(sections.map((s) => s.type)).toEqual(['form', 'project_video', 'color_background', 'project_video']);
    // project_video sections are numbered independently of their position
    expect(sections[1].name).toBe('video_1');
    expect(sections[3].name).toBe('video_2');
    // form fields preserved with localized label
    expect(sections[0].options?.fields).toEqual([{ name: 'firstname', maxLength: 40, label: { en: 'Your name' } }]);
    // color options
    expect(sections[2].options).toEqual({ duration: 3, backgroundColor: '#7C83FD' });
  });

  it('adds a centered drawtext filter only when overlay text is present', () => {
    const withText = buildDescriptor(
      baseState([
        {
          kind: 'video',
          duration: 5,
          mute: false,
          text: 'Hello',
          fontsize: 40,
          fontcolor: '#fff',
          countdown: false,
          countdownSeconds: 4,
        },
      ])
    );
    const withoutText = buildDescriptor(baseState([newSection('video')]));

    const filters = (withText.sections?.[0].filters ?? []) as Array<{
      type: string;
      values?: { text?: { en?: string } };
    }>;
    expect(filters).toHaveLength(1);
    expect(filters[0].type).toBe('drawtext');
    expect(filters[0].values?.text?.en).toBe('Hello');

    expect(withoutText.sections?.[0].filters).toBeUndefined();
  });
});

describe('buildDescriptor — music section', () => {
  it('folds a music section into global.musicEnabled/allowedMusic/allowUploadMusic', () => {
    const d = buildDescriptor(
      baseState([newSection('video'), { kind: 'music', allowed: [music1.id, music2.id], allowUpload: true }])
    );

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1.id, music2.id]);
    expect(d.global?.allowUploadMusic).toBe(true);
    // music does NOT produce its own descriptor section
    expect(d.sections?.some((s) => s.type === 'usermusic')).toBe(false);
  });

  it('emits allowUploadMusic:false when uploads are not allowed', () => {
    const d = buildDescriptor(baseState([{ kind: 'music', allowed: [music1.id], allowUpload: false }]));

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

describe('buildDescriptor — image section', () => {
  it('emits an image_background descriptor section with its duration + background globals', () => {
    const d = buildDescriptor(
      baseState([{ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 6 }])
    );

    const imageSection = d.sections?.find((s) => s.type === 'image_background');

    expect(imageSection).toMatchObject({ name: 'image_1', type: 'image_background', options: { duration: 6 } });
    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('numbers multiple image sections image_1, image_2 and de-duplicates the global union', () => {
    const d = buildDescriptor(
      baseState([
        { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 },
        { kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 5 },
      ])
    );

    const imageSections = (d.sections ?? []).filter((s) => s.type === 'image_background');

    expect(imageSections.map((s) => s.name)).toEqual(['image_1', 'image_2']);
    expect(imageSections.map((s) => s.options?.duration)).toEqual([4, 5]);
    // de-duplicated union of both shortlists
    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    // allowUpload true because at least one image section allows it
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('emits allowUploadBackground:false when no image section allows uploads', () => {
    const d = buildDescriptor(baseState([{ kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 }]));

    expect(d.global?.allowUploadBackground).toBe(false);
  });

  it('leaves background globals off and emits no image_background when there is no image section', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});

describe('toEditorState — round-trips', () => {
  it('returns a default video editor state when no template is given', () => {
    const state = toEditorState(null);

    expect(state.sections).toEqual([newSection('video')]);
    expect(state.orientation).toBe('landscape');
    expect(state.id).toMatch(/^user-/);
    expect(state.sections.some((s) => s.kind === 'music')).toBe(false);
    expect(state.sections.some((s) => s.kind === 'image')).toBe(false);
  });

  it('rehydrates form/video/color sections preserving their values', () => {
    const start = baseState([
      newSection('form'),
      {
        kind: 'video',
        duration: 6,
        mute: true,
        text: 'Overlay',
        fontsize: 50,
        fontcolor: '#101010',
        countdown: false,
        countdownSeconds: 4,
      },
      { kind: 'color', duration: 2, color: '#FF8AAE' },
    ]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections).toEqual(start.sections);
  });

  it('round-trips a music section through a stored template, surfaced at the top', () => {
    const start = baseState([
      newSection('video'),
      { kind: 'music', allowed: [music1.id, music2.id], allowUpload: true },
    ]);
    const back = toEditorState(asTemplate(start));

    const music = back.sections.find((s) => s.kind === 'music');

    expect(music).toEqual({ kind: 'music', allowed: [music1.id, music2.id], allowUpload: true });
    // music is surfaced at the top of the section list
    expect(back.sections[0].kind).toBe('music');
  });

  it('round-trips an image section (descriptor section + duration + globals)', () => {
    const start = baseState([{ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 7 }]);
    const back = toEditorState(asTemplate(start));

    const image = back.sections.find((s) => s.kind === 'image');

    expect(image).toEqual({ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 7 });
  });

  it('reconstructs image sections at their descriptor position, music at the top', () => {
    const start = baseState([
      newSection('video'),
      { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 },
      { kind: 'music', allowed: [music1.id], allowUpload: false },
    ]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections.map((s) => s.kind)).toEqual(['music', 'video', 'image']);
  });

  it('round-trips multiple image sections preserving their durations and shared globals', () => {
    const start = baseState([
      { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 3 },
      { kind: 'image', allowed: [bg2.id], allowUpload: true, duration: 9 },
    ]);
    const back = toEditorState(asTemplate(start));

    const images = back.sections.filter((s): s is Extract<EditorSection, { kind: 'image' }> => s.kind === 'image');

    expect(images.map((s) => s.duration)).toEqual([3, 9]);
    // both image sections share the de-duplicated global shortlist + allowUpload
    for (const img of images) {
      expect(img.allowed).toEqual([bg1.id, bg2.id]);
      expect(img.allowUpload).toBe(true);
    }
  });

  it('reconstructs an image section from a stored image_background descriptor', () => {
    const template: EditableTemplate = {
      id: 'tmpl-1',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: {
        global: {
          orientation: 'landscape',
          musicEnabled: false,
          transitionDuration: 0.5,
          allowedBackgrounds: [bg1.id],
          allowUploadBackground: false,
        },
        sections: [
          { name: 'video_1', type: 'project_video', options: { duration: 8 } },
          { name: 'image_1', type: 'image_background', options: { duration: 4 } },
        ],
      },
    };

    const state = toEditorState(template);

    expect(state.sections.some((s) => s.kind === 'video')).toBe(true);
    const image = state.sections.find((s) => s.kind === 'image');

    expect(image).toEqual({ kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 });
  });

  it('rehydrates allowUploadMusic into a music section even without a shortlist', () => {
    const template: EditableTemplate = {
      id: 'tmpl-2',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: {
        global: {
          orientation: 'landscape',
          musicEnabled: true,
          transitionDuration: 0.5,
          allowedMusic: [music1.id],
          allowUploadMusic: true,
        },
        sections: [{ name: 'video_1', type: 'project_video', options: { duration: 8 } }],
      },
    };

    const state = toEditorState(template);
    const music = state.sections.find((s) => s.kind === 'music');

    expect(music).toEqual({ kind: 'music', allowed: [music1.id], allowUpload: true });
  });

  it('rehydrates allowUploadBackground into an image section with duration from image_background', () => {
    const template: EditableTemplate = {
      id: 'tmpl-3',
      name: 'T',
      description: '',
      orientation: 'landscape',
      descriptor: {
        global: {
          orientation: 'landscape',
          musicEnabled: false,
          transitionDuration: 0.5,
          allowedBackgrounds: [bg1.id],
          allowUploadBackground: true,
        },
        sections: [
          { name: 'video_1', type: 'project_video', options: { duration: 8 } },
          { name: 'image_1', type: 'image_background', options: { duration: 7 } },
        ],
      },
    };

    const state = toEditorState(template);
    const image = state.sections.find((s) => s.kind === 'image');

    expect(image).toEqual({ kind: 'image', allowed: [bg1.id], allowUpload: true, duration: 7 });
  });
});
