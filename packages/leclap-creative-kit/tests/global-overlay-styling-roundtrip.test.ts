import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  renderableSectionNames,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
  type GlobalTextOverlay,
} from '../src/editor/templateEditorModel';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const stateWith = (overrides: Partial<EditorState> = {}): EditorState => ({
  id: makeTemplateId(),
  name: 'Global overlay styling test',
  description: '',
  orientation: 'landscape',
  sections: [newSection('video')],
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
  ...overrides,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

const clip = (): EditorSection => ({
  ...(newSection('video') as VideoSection),
  videoUrl: { source: 'url', url: 'https://cdn.example.com/bumper.mp4' },
});

describe('global text overlay font/size/opacity/sections', () => {
  const styled: GlobalTextOverlay = {
    text: { en: '#brand' },
    position: 'bottom-right',
    font: 'anton',
    size: 42,
    opacity: 0.6,
    sections: ['video_1'],
  };

  it('emits font, size, opacity and sections on the descriptor overlay', () => {
    const overlay = buildDescriptor(stateWith({ globalOverlays: [styled] })).global?.overlays?.[0];

    expect(overlay).toMatchObject({ font: 'anton', size: 42, opacity: 0.6, sections: ['video_1'] });
  });

  it('round-trips font, size, opacity and sections through toEditorState', () => {
    const state = stateWith({ globalOverlays: [styled] });
    const back = toEditorState(templateFrom(state));

    expect(back.globalOverlays).toEqual([styled]);
  });

  it('emits nothing for the styling fields when they are unset', () => {
    const overlay = buildDescriptor(stateWith({ globalOverlays: [{ text: { en: '#brand' } }] })).global?.overlays?.[0];

    expect(overlay).toEqual({ text: { en: '#brand' } });
  });
});

describe('global text overlay localised text', () => {
  const localised: GlobalTextOverlay = {
    text: { en: '#brand', fr: '#marque', de: '#marke' },
    position: 'top-right',
  };

  it('emits the whole locale map on the descriptor overlay', () => {
    const overlay = buildDescriptor(stateWith({ globalOverlays: [localised] })).global?.overlays?.[0];

    expect(overlay?.text).toEqual({ en: '#brand', fr: '#marque', de: '#marke' });
  });

  it('round-trips every translation through toEditorState', () => {
    const back = toEditorState(templateFrom(stateWith({ globalOverlays: [localised] })));

    expect(back.globalOverlays).toEqual([localised]);
  });

  it('keeps a row whose only text lives in a non-English locale', () => {
    const overlays = buildDescriptor(stateWith({ globalOverlays: [{ text: { fr: '#marque' } }] })).global?.overlays;

    expect(overlays).toEqual([{ text: { fr: '#marque' } }]);
  });
});

describe('renderableSectionNames', () => {
  it('lists the emitted names of the sections a global overlay can target', () => {
    const sections: EditorSection[] = [
      newSection('form'),
      newSection('video'),
      clip(),
      newSection('color'),
      newSection('image'),
      newSection('music'),
      newSection('video'),
    ];

    expect(renderableSectionNames(sections)).toEqual(['video_1', 'clip_1', 'color_2', 'image_1', 'video_2']);
  });

  it('matches the names buildDescriptor actually emits', () => {
    const sections: EditorSection[] = [newSection('color'), newSection('video'), clip(), newSection('image')];
    const emitted = (buildDescriptor(stateWith({ sections })).sections ?? []).map((s) => s.name);

    for (const name of renderableSectionNames(sections)) {
      expect(emitted).toContain(name);
    }
  });

  it('excludes form, music and partial sections', () => {
    const sections: EditorSection[] = [newSection('form'), newSection('music'), newSection('partial')];

    expect(renderableSectionNames(sections)).toEqual([]);
  });
});
