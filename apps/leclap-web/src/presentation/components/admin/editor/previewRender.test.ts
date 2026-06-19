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
