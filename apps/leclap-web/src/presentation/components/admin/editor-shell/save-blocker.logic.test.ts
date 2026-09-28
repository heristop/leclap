import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { newSection, toEditorState, type EditorState } from '../templateEditorModel';
import { saveBlocker, saveBlockerMessage, saveFeedback } from './save-blocker.logic';

const named = (patch: Partial<EditorState> = {}): EditorState => ({ ...toEditorState(null), name: 'Launch', ...patch });

describe('saveBlocker', () => {
  it('asks for a name before anything else', () => {
    expect(saveBlocker(named({ name: '   ', sections: [] }))).toEqual({ kind: 'name' });
  });

  it('needs at least one scene', () => {
    expect(saveBlocker(named({ sections: [] }))).toEqual({ kind: 'sections' });
  });

  it('points at the first media scene that offers nothing and takes no upload', () => {
    const state = named({ sections: [newSection('video'), newSection('image'), newSection('music')] });

    expect(saveBlocker(state)).toEqual({ kind: 'media', index: 1, section: 'image' });
  });

  it('lets a media scene through once it allows uploads or offers an option', () => {
    const music = { ...newSection('music'), allowUpload: true };
    const image = { ...newSection('image'), allowed: ['sunset'] };

    expect(saveBlocker(named({ sections: [music, image] }))).toBeNull();
  });

  it('returns null for a template that can be saved', () => {
    expect(saveBlocker(named())).toBeNull();
  });
});

describe('saveBlockerMessage', () => {
  // Echoes the key and its options, so the assertions pin which copy each blocker picks.
  const t = ((key: string, options?: Record<string, unknown>) =>
    options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction<'admin'>;

  it('reuses the editor validation copy for a missing name or scene', () => {
    expect(saveBlockerMessage({ kind: 'name' }, t)).toBe('editor.validation.name');
    expect(saveBlockerMessage({ kind: 'sections' }, t)).toBe('editor.validation.atLeastOneSection');
  });

  it('names the media scene in its own localized label', () => {
    expect(saveBlockerMessage({ kind: 'media', index: 2, section: 'music' }, t)).toBe(
      'editor.validation.mediaOrUpload {"label":"editor.sectionLabel.music"}'
    );
  });
});

describe('saveFeedback', () => {
  const t = ((key: string) => key) as unknown as TFunction<'admin'>;

  it('says nothing until a save was refused or failed', () => {
    expect(saveFeedback(null, null, t)).toBeNull();
  });

  it('warns with the blocker the author can fix', () => {
    expect(saveFeedback({ kind: 'name' }, null, t)).toEqual({ tone: 'warning', message: 'editor.validation.name' });
  });

  it('reports a failed write in the app language, keeping the validator detail aside', () => {
    expect(saveFeedback(null, 'sections.2: duration must be positive', t)).toEqual({
      tone: 'error',
      message: 'validation.saveFailed',
      detail: 'sections.2: duration must be positive',
    });
    expect(saveFeedback(null, '', t)).toEqual({ tone: 'error', message: 'validation.saveFailed' });
  });
});
