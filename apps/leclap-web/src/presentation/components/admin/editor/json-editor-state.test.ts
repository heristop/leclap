// Pure dirty/sync/apply glue for the raw-JSON escape hatch panel. No DOM, no CodeMirror — the
// component owns rendering + debounce timers; this module owns the state machine so it is
// unit-testable without rendering. Validation itself always goes through templateIO's
// importDescriptorJson (the single validation seam) — applyJsonEdit is a thin wrapper around it.
import { describe, it, expect } from 'vitest';
import { buildDescriptor, newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import { exportDescriptorJson } from './templateIO';
import {
  applyJsonEdit,
  createJsonEditorSnapshot,
  editJsonEditorSnapshot,
  stateChangedUnderneath,
  syncJsonEditorSnapshot,
} from './json-editor-state';

function state(over: Partial<EditorState> = {}): EditorState {
  const video = { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), duration: 6 };

  return {
    id: 'user-42',
    name: 'My Template',
    description: 'A demo',
    orientation: 'portrait',
    sections: [newSection('form'), video, newSection('color')],
    globalVariables: [{ name: 'brand', value: 'LeClap' }],
    audio: { sourceVolume: 1, musicVolume: 0.5, ducking: false },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
    globalOverlays: [],
    ...over,
  };
}

describe('createJsonEditorSnapshot', () => {
  it('seeds text and syncedFrom from the exported JSON, not dirty', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);

    expect(snapshot.text).toBe(exported);
    expect(snapshot.syncedFrom).toBe(exported);
    expect(snapshot.dirty).toBe(false);
  });
});

describe('editJsonEditorSnapshot', () => {
  it('marks the snapshot dirty when the text diverges from syncedFrom', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);

    const edited = editJsonEditorSnapshot(snapshot, exported.replace('"My Template"', '"Edited"'));

    expect(edited.dirty).toBe(true);
    expect(edited.syncedFrom).toBe(exported);
  });

  it('clears dirty when the text is edited back to match syncedFrom', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);
    const edited = editJsonEditorSnapshot(snapshot, exported + ' ');

    expect(editJsonEditorSnapshot(edited, exported).dirty).toBe(false);
  });
});

describe('syncJsonEditorSnapshot', () => {
  it('refreshes text and syncedFrom to the latest export when not dirty', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);
    const nextExported = exportDescriptorJson(state({ name: 'Renamed' }));

    const synced = syncJsonEditorSnapshot(snapshot, nextExported);

    expect(synced.text).toBe(nextExported);
    expect(synced.syncedFrom).toBe(nextExported);
    expect(synced.dirty).toBe(false);
  });

  it('leaves a dirty snapshot untouched (keeps the user text)', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = editJsonEditorSnapshot(createJsonEditorSnapshot(exported), '{ "not": "saved yet" }');
    const nextExported = exportDescriptorJson(state({ name: 'Renamed' }));

    const synced = syncJsonEditorSnapshot(snapshot, nextExported);

    expect(synced).toBe(snapshot);
  });

  it('is a no-op when not dirty and the export has not changed', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);

    expect(syncJsonEditorSnapshot(snapshot, exported)).toBe(snapshot);
  });
});

describe('stateChangedUnderneath', () => {
  it('is false while clean, no matter what the live export says', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = createJsonEditorSnapshot(exported);

    expect(stateChangedUnderneath(snapshot, exportDescriptorJson(state({ name: 'Renamed' })))).toBe(false);
  });

  it('is false while dirty as long as the live export still matches syncedFrom', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = editJsonEditorSnapshot(createJsonEditorSnapshot(exported), '{ "draft": true }');

    expect(stateChangedUnderneath(snapshot, exported)).toBe(false);
  });

  it('is true once dirty AND the live export has moved on from syncedFrom', () => {
    const exported = exportDescriptorJson(state());
    const snapshot = editJsonEditorSnapshot(createJsonEditorSnapshot(exported), '{ "draft": true }');
    const nextExported = exportDescriptorJson(state({ name: 'Renamed elsewhere' }));

    expect(stateChangedUnderneath(snapshot, nextExported)).toBe(true);
  });
});

describe('applyJsonEdit', () => {
  it('on valid JSON: reports ok, hands back the imported EditorState, and resets the snapshot clean', () => {
    const original = state();
    const edited = state({ name: 'From JSON' });
    const text = exportDescriptorJson(edited);
    const snapshot = editJsonEditorSnapshot(createJsonEditorSnapshot(exportDescriptorJson(original)), text);

    const outcome = applyJsonEdit(snapshot, original);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.imported.name).toBe('From JSON');
    expect(buildDescriptor(outcome.imported)).toEqual(buildDescriptor(edited));
    expect(outcome.snapshot.dirty).toBe(false);
    expect(outcome.snapshot.text).toBe(exportDescriptorJson(outcome.imported));
  });

  it('on invalid JSON: reports errors and leaves the snapshot (still dirty) untouched', () => {
    const original = state();
    const snapshot = editJsonEditorSnapshot(
      createJsonEditorSnapshot(exportDescriptorJson(original)),
      '{ "sections": [{ "type": "not_a_real_type" }] }'
    );

    const outcome = applyJsonEdit(snapshot, original);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.length).toBeGreaterThan(0);
    expect(outcome.snapshot).toBe(snapshot);
  });

  it('on malformed JSON: surfaces the parse error', () => {
    const original = state();
    const snapshot = editJsonEditorSnapshot(createJsonEditorSnapshot(exportDescriptorJson(original)), '{ not json');

    const outcome = applyJsonEdit(snapshot, original);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0]).toContain('Invalid JSON');
  });
});
