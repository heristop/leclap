import { describe, it, expect } from 'vitest';
import { newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import { MUSIC_LIBRARY } from '@/data/mediaCatalog';
import { previewTemplate } from './previewRender';

function state(sections: EditorSection[]): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections,
    globalVariables: [],
    audio: { sourceVolume: 1, musicVolume: 0.5, ducking: false },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
    globalOverlays: [],
  };
}

const imageSectionWith = (allowed: string[]): EditorSection => ({ ...newSection('image'), allowed }) as EditorSection;

const pictureUrlOf = (s: EditorState): string | undefined => {
  const section = (previewTemplate(s).descriptor.sections ?? []).find((sec) => sec.type === 'image_background');

  return (section?.options as { pictureUrl?: string } | undefined)?.pictureUrl;
};

describe('previewTemplate — image_background stand-in', () => {
  it('fills an image_background with the first allowed background so the draft has an image input', () => {
    expect(pictureUrlOf(state([imageSectionWith(['forest-sea'])]))).toBe('/backgrounds/forest-sea.jpg');
  });

  it('falls back to any bundled background when none is allowed', () => {
    expect(pictureUrlOf(state([imageSectionWith([])]))).toMatch(/^\/backgrounds\/.+\.jpg$/);
  });
});

// Regression: a video section with an author-added library image overlay reached the engine as a raw
// `library://<id>` url it could not fetch, aborting the segment in WASM ("Output file not found"). The
// preview must resolve the marker to the curated `/backgrounds/<file>` url, like the Save & film path.
describe('previewTemplate — library image-overlay markers', () => {
  function videoWithLibraryImage(id: string): EditorSection {
    return { ...newSection('video'), images: [{ id: 'img1', choice: { source: 'library', id } }] } as EditorSection;
  }

  it('resolves a library:// image-overlay marker to its /backgrounds url', () => {
    const descriptor = previewTemplate(state([videoWithLibraryImage('forest-sea')])).descriptor;
    const input = (descriptor.sections ?? []).flatMap((s) => s.inputs ?? []).find((i) => i.type === 'image');

    expect(input?.url).toBe('/backgrounds/forest-sea.jpg');
    expect(input?.url?.startsWith('library://')).toBe(false);
  });
});

// The draft is a whole-template render, so a music scene must produce audible music without the
// end-user pick: the first allowed library track, else the bundled default (same stand-in rule as
// image backgrounds). A template without a music scene stays silent.
describe('previewTemplate — music stand-in', () => {
  function musicSectionWith(allowed: string[]): EditorSection {
    return { ...newSection('music'), allowed } as EditorSection;
  }

  it('fills global.music with the first allowed library track', () => {
    const pick = MUSIC_LIBRARY.at(1) ?? MUSIC_LIBRARY.at(0);
    if (!pick) throw new Error('expected a bundled music library');

    const descriptor = previewTemplate(state([newSection('video'), musicSectionWith([pick.id])])).descriptor;

    expect(descriptor.global?.music).toEqual({ name: pick.id, url: pick.url });
    expect(descriptor.global?.musicEnabled).toBe(true);
  });

  it('falls back to a bundled default track when nothing is selected', () => {
    const fallback = MUSIC_LIBRARY.at(0);
    if (!fallback) throw new Error('expected a bundled music library');

    const descriptor = previewTemplate(state([newSection('video'), musicSectionWith([])])).descriptor;

    expect(descriptor.global?.music).toEqual({ name: fallback.id, url: fallback.url });
  });

  it('adds no music without a music scene', () => {
    const descriptor = previewTemplate(state([newSection('video')])).descriptor;

    expect(descriptor.global?.music).toBeUndefined();
  });
});

// Regression: the engine's template validation rejects a non-cut transition on the LAST rendering
// section ("dangling_transition"), which aborted the whole preview compile when an author had set a
// transition on their final scene. The draft must always render — the validation error still shows
// on the scene card for the real flow, but the preview strips the dangling transition instead of dying.
describe('previewTemplate — dangling transition', () => {
  it('strips a non-cut transition from the last rendering section', () => {
    const video = {
      ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
      transitionAfter: { type: 'fade', duration: 0.5 },
    };
    const descriptor = previewTemplate(state([video])).descriptor;
    const section = (descriptor.sections ?? []).find((s) => s.type === 'project_video');

    expect(section?.transition).toBeUndefined();
  });

  it('keeps a transition that leads into a following rendering section', () => {
    const video = {
      ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
      transitionAfter: { type: 'fade', duration: 0.5 },
    };
    const descriptor = previewTemplate(state([video, newSection('color')])).descriptor;
    const section = (descriptor.sections ?? []).find((s) => s.type === 'project_video');

    expect(section?.transition).toEqual({ type: 'fade', duration: 0.5 });
  });

  it('is not shielded by a trailing non-rendering section', () => {
    const video = {
      ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
      transitionAfter: { type: 'fade', duration: 0.5 },
    };
    const descriptor = previewTemplate(state([video, newSection('form')])).descriptor;
    const section = (descriptor.sections ?? []).find((s) => s.type === 'project_video');

    expect(section?.transition).toBeUndefined();
  });
});
