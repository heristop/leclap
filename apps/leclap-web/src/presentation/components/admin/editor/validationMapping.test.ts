import { describe, it, expect } from 'vitest';
import { buildDescriptor, newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import type { StoredPartial } from '@/stores/userPartialStore';
import {
  descriptorIndexFromPath,
  descriptorIndexForEditor,
  editorIndexForDescriptor,
  errorsForEditorSection,
  groupValidationErrors,
  runValidation,
} from './validationMapping';

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
  };
}

describe('descriptorIndexFromPath', () => {
  it('extracts the leading sections[N] index', () => {
    expect(descriptorIndexFromPath('sections[2].transition')).toBe(2);
    expect(descriptorIndexFromPath('sections[0].motion')).toBe(0);
  });

  it('normalises the validator template. prefix', () => {
    expect(descriptorIndexFromPath('template.sections[3].options.text')).toBe(3);
  });

  it('returns null for unanchored paths', () => {
    expect(descriptorIndexFromPath('global.audio')).toBeNull();
    expect(descriptorIndexFromPath('root')).toBeNull();
  });
});

describe('descriptor <-> editor index mapping (music folds into globals)', () => {
  it('skips music sections, which have no descriptor entry', () => {
    const s = state([newSection('music'), newSection('video'), newSection('video')]);
    // editor: [music, video, video] -> descriptor: [video(0), video(1)]
    expect(descriptorIndexForEditor(s)).toEqual([null, 0, 1]);
    expect(editorIndexForDescriptor(s, 0)).toBe(1);
    expect(editorIndexForDescriptor(s, 1)).toBe(2);
  });
});

describe('groupValidationErrors + errorsForEditorSection', () => {
  it('anchors a dangling-transition error on the right editor card despite a leading music section', () => {
    // A non-cut transition on the LAST visual section is dangling. Put a music section first so the
    // descriptor index (1) differs from the editor index (2) — the mapping must bridge them.
    const lastVideo = { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>) };
    lastVideo.transitionAfter = { type: 'fade', duration: 0.4 };

    const s = state([newSection('music'), newSection('video'), lastVideo]);

    const errors = runValidation(buildDescriptor(s));
    const dangling = errors.find((e) => e.code === 'dangling_transition');
    expect(dangling).toBeDefined();
    expect(dangling?.path).toBe('sections[1].transition');

    const grouped = groupValidationErrors(errors);
    expect(grouped.hasErrors).toBe(true);

    // descriptor index 1 -> editor index 2 (the last video card).
    const onLastVideo = errorsForEditorSection(grouped, s, 2);
    expect(onLastVideo.some((e) => e.code === 'dangling_transition')).toBe(true);

    // The music card (editor 0) and the first video (editor 1) carry no error.
    expect(errorsForEditorSection(grouped, s, 0)).toHaveLength(0);
    expect(errorsForEditorSection(grouped, s, 1)).toHaveLength(0);
  });

  it('reports a clean template as having no errors', () => {
    const s = state([newSection('video'), newSection('video')]);
    const grouped = groupValidationErrors(runValidation(buildDescriptor(s)));
    expect(grouped.hasErrors).toBe(false);
    expect(grouped.global).toHaveLength(0);
  });

  it('validates local partial refs through the provided registry', () => {
    const localPartial: StoredPartial = {
      id: 'local:intro',
      description: 'Local intro',
      source: 'local',
      createdAt: 1,
      updatedAt: 1,
      sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '#111111' } }],
    };
    const s = state([{ kind: 'partial', ref: 'local:intro', variables: [] }]);

    expect(runValidation(buildDescriptor(s), [localPartial])).toEqual([]);
  });
});
