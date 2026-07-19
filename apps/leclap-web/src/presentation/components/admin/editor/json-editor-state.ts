// Pure dirty/sync/apply state machine for the raw-JSON escape hatch panel (Advanced tab). The
// component owns the CodeMirror surface and debounce timers; this module owns the bookkeeping so
// it stays unit-testable without rendering. Zero validation logic of its own — applyJsonEdit is a
// thin wrapper around templateIO's importDescriptorJson, the single validation seam.
import type { EditorState } from '../templateEditorModel';
import { exportDescriptorJson, importDescriptorJson } from './templateIO';

export interface JsonEditorSnapshot {
  // The live editor buffer (what the user sees/types).
  text: string;
  // True once `text` has diverged from `syncedFrom` (unapplied local edits).
  dirty: boolean;
  // The last exported descriptor JSON `text` was reset from — the baseline dirty is measured
  // against, and what `stateChangedUnderneath` compares the live export to.
  syncedFrom: string;
}

export type ApplyOutcome =
  | { ok: true; imported: EditorState; snapshot: JsonEditorSnapshot }
  | { ok: false; errors: string[]; snapshot: JsonEditorSnapshot };

// A fresh, clean snapshot seeded from an exported descriptor (initial mount, or right after a
// successful Apply / file import).
export function createJsonEditorSnapshot(exported: string): JsonEditorSnapshot {
  return { text: exported, dirty: false, syncedFrom: exported };
}

// The user typed something. Dirty tracks divergence from syncedFrom — editing back to the exact
// synced text (e.g. undo) clears it again, same as a form field.
export function editJsonEditorSnapshot(snapshot: JsonEditorSnapshot, text: string): JsonEditorSnapshot {
  return { ...snapshot, text, dirty: text !== snapshot.syncedFrom };
}

// Two-way sync: called whenever the form state changes elsewhere. Not dirty -> the panel is just a
// mirror, so refresh it to the new export. Dirty -> the user's local edits win; the snapshot is
// left untouched (same reference, so callers can skip a re-render) and the caller shows a "state
// changed underneath" hint via stateChangedUnderneath instead.
export function syncJsonEditorSnapshot(snapshot: JsonEditorSnapshot, exported: string): JsonEditorSnapshot {
  if (snapshot.dirty) return snapshot;

  if (exported === snapshot.syncedFrom) return snapshot;

  return createJsonEditorSnapshot(exported);
}

// True once there are unapplied local edits AND the live form state has moved on since the text
// was last synced from it — the two things happened concurrently and only one can win.
export function stateChangedUnderneath(snapshot: JsonEditorSnapshot, exported: string): boolean {
  return snapshot.dirty && exported !== snapshot.syncedFrom;
}

// Apply runs the buffer through the existing importDescriptorJson (no custom validation). On
// success the caller still owns calling onImport(imported) — this only computes the pure result —
// and the snapshot resets clean, rebased on the re-serialised, round-tripped descriptor (so the
// panel shows exactly what the rest of the app now holds). On failure the snapshot is returned
// unchanged (still dirty) so the user's text is never clobbered by a rejected edit.
export function applyJsonEdit(snapshot: JsonEditorSnapshot, current: EditorState): ApplyOutcome {
  const result = importDescriptorJson(snapshot.text, current);

  if (!result.ok) {
    return { ok: false, errors: result.errors, snapshot };
  }

  return {
    ok: true,
    imported: result.state,
    snapshot: createJsonEditorSnapshot(exportDescriptorJson(result.state)),
  };
}
