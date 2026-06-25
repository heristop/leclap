import { describe, it, expect } from 'vitest';
import { newSection, type EditorState, type EditorSection } from '../templateEditorModel';
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
