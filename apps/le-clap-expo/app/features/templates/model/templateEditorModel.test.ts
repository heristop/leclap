import {
  buildDescriptor,
  newSection,
  toEditorState,
  type EditorState,
  type EditableTemplate,
} from './templateEditorModel';

const baseState = (sections: EditorState['sections']): EditorState => ({
  id: 'user-test',
  name: 'My template',
  description: 'desc',
  orientation: 'landscape',
  musicEnabled: true,
  sections,
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
    });
    expect(newSection('color')).toEqual({ kind: 'color', duration: 3, color: '#7C83FD' });
    expect(newSection('form')).toEqual({
      kind: 'form',
      fields: [{ name: 'firstname', label: 'Your name', maxLength: 40 }],
    });
  });
});

describe('buildDescriptor', () => {
  it('maps form/video/color sections to a descriptor and numbers videos', () => {
    const descriptor = buildDescriptor(
      baseState([
        newSection('form'),
        { kind: 'video', duration: 6, mute: true, text: 'Hi {{ firstname }}', fontsize: 50, fontcolor: '#000000' },
        newSection('color'),
        { kind: 'video', duration: 4, mute: false, text: '', fontsize: 48, fontcolor: '#ffffff' },
      ])
    );

    expect(descriptor.global).toEqual({ orientation: 'landscape', musicEnabled: true, transitionDuration: 0.5 });
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
      baseState([{ kind: 'video', duration: 5, mute: false, text: 'Hello', fontsize: 40, fontcolor: '#fff' }])
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

describe('toEditorState round-trip', () => {
  it('returns a default video editor state when no template is given', () => {
    const state = toEditorState(null);
    expect(state.sections).toEqual([newSection('video')]);
    expect(state.orientation).toBe('landscape');
    expect(state.id).toMatch(/^user-/);
  });

  it('rehydrates a built descriptor back into equivalent editor sections', () => {
    const original = baseState([
      newSection('form'),
      { kind: 'video', duration: 6, mute: true, text: 'Overlay', fontsize: 50, fontcolor: '#101010' },
      { kind: 'color', duration: 2, color: '#FF8AAE' },
    ]);

    const template: EditableTemplate = {
      id: original.id,
      name: original.name,
      description: original.description,
      orientation: original.orientation,
      descriptor: buildDescriptor(original),
    };

    const rehydrated = toEditorState(template);

    expect(rehydrated.musicEnabled).toBe(true);
    expect(rehydrated.sections).toEqual(original.sections);
  });
});
