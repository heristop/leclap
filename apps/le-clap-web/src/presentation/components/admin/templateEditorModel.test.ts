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
    allowUploadMusic: false,
    backgroundEnabled: false,
    allowedBackgrounds: [],
    allowUploadBackground: false,
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
  it('emits global.allowedMusic + allowUploadMusic when music is enabled', () => {
    const d = buildDescriptor(
      baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id], allowUploadMusic: false })
    );

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1.id, music2.id]);
    expect(d.global?.allowUploadMusic).toBe(false);
  });

  it('emits allowUploadMusic:true when flagged', () => {
    const d = buildDescriptor(baseState({ musicEnabled: true, allowedMusic: [], allowUploadMusic: true }));

    expect(d.global?.allowUploadMusic).toBe(true);
  });

  it('omits allowedMusic and allowUploadMusic when music is disabled', () => {
    const d = buildDescriptor(baseState({ musicEnabled: false, allowedMusic: [music1.id], allowUploadMusic: true }));

    expect(d.global?.allowedMusic).toBeUndefined();
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });
});

describe('templateEditorModel — background shortlist', () => {
  it('emits global.allowedBackgrounds + allowUploadBackground when background is enabled', () => {
    const d = buildDescriptor(
      baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id, bg2.id], allowUploadBackground: false })
    );

    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    expect(d.global?.allowUploadBackground).toBe(false);
  });

  it('appends a background_1 image_background placeholder section when background is enabled', () => {
    const d = buildDescriptor(
      baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id], allowUploadBackground: false })
    );

    const bgSection = d.sections?.find((s) => s.name === 'background_1');

    expect(bgSection).toMatchObject({ name: 'background_1', type: 'image_background', options: { duration: 4 } });
    // placeholder has no pictureUrl
    expect((bgSection?.options as { pictureUrl?: string } | undefined)?.pictureUrl).toBeUndefined();
  });

  it('omits allowedBackgrounds and the background_1 section when background is disabled', () => {
    const d = buildDescriptor(
      baseState({ backgroundEnabled: false, allowedBackgrounds: [bg1.id], allowUploadBackground: true })
    );

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});

describe('templateEditorModel — round-trips', () => {
  it('round-trips musicEnabled + allowedMusic through a stored template', () => {
    const start = baseState({ musicEnabled: true, allowedMusic: [music1.id, music2.id], allowUploadMusic: true });
    const back = toEditorState(asTemplate(start));

    expect(back.musicEnabled).toBe(true);
    expect(back.allowedMusic).toEqual([music1.id, music2.id]);
    expect(back.allowUploadMusic).toBe(true);
  });

  it('round-trips backgroundEnabled + allowedBackgrounds through a stored template', () => {
    const start = baseState({ backgroundEnabled: true, allowedBackgrounds: [bg1.id], allowUploadBackground: false });
    const back = toEditorState(asTemplate(start));

    expect(back.backgroundEnabled).toBe(true);
    expect(back.allowedBackgrounds).toEqual([bg1.id]);
    expect(back.allowUploadBackground).toBe(false);
    // the background_1 placeholder is skipped when mapping sections back to editor
    expect(back.sections.some((s) => s.kind === ('image' as string))).toBe(false);
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
    expect(state.allowUploadMusic).toBe(false);
    expect(state.backgroundEnabled).toBe(false);
    expect(state.allowedBackgrounds).toEqual([]);
    expect(state.allowUploadBackground).toBe(false);
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].kind).toBe('video');
  });
});
