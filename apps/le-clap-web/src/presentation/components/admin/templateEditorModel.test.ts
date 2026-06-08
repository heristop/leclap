import { describe, it, expect } from 'vitest';
import { buildDescriptor, toEditorState, newSection, type EditorState } from './templateEditorModel';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY } from '@/data/mediaCatalog';
import type { Template } from '@/services/templateService';

function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    musicEnabled: false,
    allowedMusic: [],
    backgroundEnabled: false,
    allowedBackgrounds: [],
    sections: [newSection('video')],
    ...over,
  };
}

function asTemplate(state: EditorState): Template {
  return {
    id: state.id,
    name: state.name,
    description: state.description,
    orientation: state.orientation,
    hasForm: false,
    complexity: 'simple',
    source: 'user',
    descriptor: buildDescriptor(state),
  };
}

const music1 = MUSIC_LIBRARY[0];
const music2 = MUSIC_LIBRARY[1];
const bg1 = BACKGROUND_LIBRARY[0];
const bg2 = BACKGROUND_LIBRARY[1];

describe('templateEditorModel — music shortlist', () => {
  it('emits global.allowedMusic when musicEnabled with a shortlist', () => {
    const d = buildDescriptor(baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id] }));

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1.id, music2.id]);
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });

  it('emits allowUploadMusic:true when a usermusic section is present', () => {
    const d = buildDescriptor(baseState({ sections: [newSection('video'), newSection('usermusic')] }));

    expect(d.global?.allowUploadMusic).toBe(true);
    expect(d.global?.musicEnabled).toBe(true);
  });

  it('omits allowedMusic and allowUploadMusic when musicEnabled:false and no usermusic section', () => {
    const d = buildDescriptor(baseState({ musicEnabled: false, allowedMusic: [music1.id] }));

    expect(d.global?.allowedMusic).toBeUndefined();
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });
});

describe('templateEditorModel — background shortlist', () => {
  it('emits global.allowedBackgrounds when backgroundEnabled with a shortlist', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id, bg2.id] }));

    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    expect(d.global?.allowUploadBackground).toBeUndefined();
  });

  it('appends a background_1 placeholder when backgroundEnabled', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id] }));

    const bgSection = d.sections?.find((s) => s.name === 'background_1');

    expect(bgSection).toMatchObject({ name: 'background_1', type: 'image_background', options: { duration: 4 } });
    // placeholder has no pictureUrl
    expect((bgSection?.options as { pictureUrl?: string } | undefined)?.pictureUrl).toBeUndefined();
  });

  it('emits allowUploadBackground:true when a userphoto section is present', () => {
    const d = buildDescriptor(baseState({ sections: [newSection('video'), newSection('userphoto')] }));

    expect(d.global?.allowUploadBackground).toBe(true);
    // also emits the background_1 placeholder with the section's duration
    const bgSection = d.sections?.find((s) => s.name === 'background_1');

    expect(bgSection).toMatchObject({ name: 'background_1', type: 'image_background', options: { duration: 4 } });
  });

  it('userphoto section duration is used in background_1 placeholder', () => {
    const d = buildDescriptor(baseState({ sections: [{ kind: 'userphoto', duration: 7 }] }));

    const bgSection = d.sections?.find((s) => s.name === 'background_1');

    expect(bgSection?.options?.duration).toBe(7);
  });

  it('omits allowedBackgrounds and background_1 when backgroundEnabled:false and no userphoto section', () => {
    const d = buildDescriptor(baseState({ backgroundEnabled: false, allowedBackgrounds: [bg1.id] }));

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});

describe('templateEditorModel — round-trips', () => {
  it('round-trips musicEnabled + allowedMusic through a stored template', () => {
    const start = baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id] });
    const back = toEditorState(asTemplate(start));

    expect(back.musicEnabled).toBe(true);
    expect(back.allowedMusic).toEqual([music1.id, music2.id]);
    expect(back.sections.some((s) => s.kind === 'usermusic')).toBe(false);
  });

  it('round-trips a usermusic section: allowUploadMusic → usermusic section reappears', () => {
    const start = baseState({ sections: [newSection('video'), newSection('usermusic')] });
    const back = toEditorState(asTemplate(start));

    expect(back.sections.some((s) => s.kind === 'usermusic')).toBe(true);
    expect(back.sections.every((s) => s.kind !== 'userphoto')).toBe(true);
  });

  it('round-trips backgroundEnabled + allowedBackgrounds through a stored template', () => {
    const start = baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id] });
    const back = toEditorState(asTemplate(start));

    expect(back.backgroundEnabled).toBe(true);
    expect(back.allowedBackgrounds).toEqual([bg1.id]);
    expect(back.sections.some((s) => s.kind === 'userphoto')).toBe(false);
    // the background_1 placeholder is skipped when mapping sections back to editor
    expect(back.sections.some((s) => s.kind === ('image' as string))).toBe(false);
  });

  it('round-trips a userphoto section: allowUploadBackground → userphoto section reappears', () => {
    const start = baseState({ sections: [newSection('video'), { kind: 'userphoto', duration: 6 }] });
    const back = toEditorState(asTemplate(start));

    const userphoto = back.sections.find((s) => s.kind === 'userphoto');

    expect(userphoto).toBeDefined();
    expect((userphoto as { kind: 'userphoto'; duration: number } | undefined)?.duration).toBe(6);
    expect(back.sections.every((s) => s.kind !== ('image' as string))).toBe(true);
  });

  it('detects backgroundEnabled from a legacy stored template with an image_background section', () => {
    const legacyDescriptor = {
      global: { orientation: 'landscape' as const, musicEnabled: false },
      sections: [
        { name: 'video_1', type: 'project_video' as const, options: { duration: 8 } },
        {
          name: 'image_1',
          type: 'image_background' as const,
          options: { duration: 4, pictureUrl: '/backgrounds/forest-sea.jpg' },
        },
      ],
    };
    const template: Template = {
      id: 'legacy-1',
      name: 'Legacy',
      description: '',
      orientation: 'landscape',
      hasForm: false,
      complexity: 'simple',
      source: 'user',
      descriptor: legacyDescriptor,
    };
    const state = toEditorState(template);

    expect(state.backgroundEnabled).toBe(true);
    // the image_background section is NOT mapped as an editor section
    expect(state.sections.every((s) => s.kind !== ('image' as string))).toBe(true);
    // the video section IS mapped
    expect(state.sections.some((s) => s.kind === 'video')).toBe(true);
  });

  it('toEditorState returns a blank state for null template', () => {
    const state = toEditorState(null);

    expect(state.musicEnabled).toBe(false);
    expect(state.allowedMusic).toEqual([]);
    expect(state.backgroundEnabled).toBe(false);
    expect(state.allowedBackgrounds).toEqual([]);
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].kind).toBe('video');
  });
});
