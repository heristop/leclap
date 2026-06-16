// Pure state operations (state in -> new state out; never mutate the input) and
// bounded undo/redo history. No React/DOM/RN dependency.
import {
  newSection,
  type EditorSection,
  type EditorState,
  type SectionTransition,
  type BackgroundLayer,
} from './model';

export function patch(state: EditorState, p: Partial<EditorState>): EditorState {
  return { ...state, ...p };
}

export function patchSection(state: EditorState, index: number, p: Partial<EditorSection>): EditorState {
  return {
    ...state,
    sections: state.sections.map((sec, i) => (i === index ? ({ ...sec, ...p } as EditorSection) : sec)),
  };
}

export function addSection(state: EditorState, kind: EditorSection['kind']): EditorState {
  return { ...state, sections: [...state.sections, newSection(kind)] };
}

export function removeSection(state: EditorState, index: number): EditorState {
  return { ...state, sections: state.sections.filter((_, i) => i !== index) };
}

export function reorderSection(state: EditorState, from: number, to: number): EditorState {
  if (to < 0 || to >= state.sections.length || from < 0 || from >= state.sections.length) return state;

  const next = [...state.sections];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return { ...state, sections: next };
}

// Deep-copy the section at `index` and insert the copy right after it. The copy's
// human-facing name (form field labels / overlay text) is left untouched; only the
// descriptor numbering is derived later in buildDescriptor, so we don't need to
// rename here — but for kinds carrying a user label we suffix it to keep it distinct.
export function duplicateSection(state: EditorState, index: number): EditorState {
  if (index < 0 || index >= state.sections.length) return state;

  const copy = suffixSectionName(structuredCopy(state.sections[index]));
  const next = [...state.sections];
  next.splice(index + 1, 0, copy);

  return { ...state, sections: next };
}

// A platform-agnostic deep copy (structuredClone is available on modern Node, browsers and Hermes;
// JSON round-trip is the universal fallback for the plain-data EditorSection shape).
function structuredCopy<T>(value: T): T {
  const clone = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone;

  if (clone) return clone(value);

  return JSON.parse(JSON.stringify(value)) as T;
}

// Suffix the first user-facing label on a duplicated section with " copy" so the
// two are distinguishable in the UI. Sections without a label are returned as-is.
function suffixSectionName(section: EditorSection): EditorSection {
  if (section.kind === 'video' && section.overlays.length > 0) {
    const overlays = section.overlays.map((o, i) => (i === 0 ? { ...o, text: appendCopy(o.text) } : o));

    return { ...section, overlays };
  }

  if (section.kind === 'form' && section.fields.length > 0) {
    const fields = section.fields.map((f, i) => (i === 0 ? { ...f, label: appendCopy(f.label) } : f));

    return { ...section, fields };
  }

  return section;
}

function appendCopy(label: string): string {
  if (label.trim() === '') return label;

  return `${label} copy`;
}

// Set (or clear, with `undefined`) the transition emitted after a visual section.
// music sections have no transition and are left untouched.
export function setTransitionAfter(
  state: EditorState,
  index: number,
  transition: SectionTransition | undefined
): EditorState {
  if (index < 0 || index >= state.sections.length) return state;

  if (state.sections[index].kind === 'music') return state;

  return patchSection(state, index, { transitionAfter: transition } as Partial<EditorSection>);
}

// Replace the background layers of a color section. No-op for any other kind.
export function patchLayers(state: EditorState, index: number, layers: BackgroundLayer[]): EditorState {
  if (index < 0 || index >= state.sections.length) return state;

  if (state.sections[index].kind !== 'color') return state;

  return patchSection(state, index, { layers } as Partial<EditorSection>);
}

// --- bounded undo/redo history (pure; no UI deps) ---

const HISTORY_LIMIT = 50;

export interface History {
  state: EditorState;
  set: (next: EditorState) => void;
  undo: () => void;
  redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

// A small closure-based history with a bounded past stack (50 entries) and a future
// stack that any `set` clears. `set`/`undo`/`redo` mutate the closure in place and
// move `state` to the current entry — callers read `history.state` after each call.
export function createHistory(initial: EditorState): History {
  let past: EditorState[] = [];
  let present = initial;
  let future: EditorState[] = [];

  const api: History = {
    state: present,
    set(next: EditorState) {
      past = [...past, present].slice(-HISTORY_LIMIT);
      present = next;
      future = [];
      sync();
    },
    undo() {
      if (past.length === 0) return;

      future = [present, ...future];
      present = past.at(-1) as EditorState;
      past = past.slice(0, -1);
      sync();
    },
    redo() {
      if (future.length === 0) return;

      past = [...past, present].slice(-HISTORY_LIMIT);
      present = future[0];
      future = future.slice(1);
      sync();
    },
    canUndo: false,
    canRedo: false,
  };

  function sync(): void {
    api.state = present;
    (api as { canUndo: boolean }).canUndo = past.length > 0;
    (api as { canRedo: boolean }).canRedo = future.length > 0;
  }

  return api;
}
