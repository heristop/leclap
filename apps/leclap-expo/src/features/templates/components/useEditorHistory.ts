import { useCallback, useState } from 'react';
import type { EditorState } from '../model/templateEditorModel';

const HISTORY_LIMIT = 50;

type Updater = EditorState | ((s: EditorState) => EditorState);

interface History {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
}

export interface EditorHistory {
  state: EditorState;
  setState: (updater: Updater) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Bounded undo/redo around the editor state, mirroring the web useEditorHistory. Every committed
// change pushes the prior state onto `past` (capped at HISTORY_LIMIT) and clears the redo stack;
// drop-in for useState since `setState` accepts the same value-or-updater shape the screen already uses.
export function useEditorHistory(init: () => EditorState): EditorHistory {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: init(), future: [] }));

  const setState = useCallback((updater: Updater) => {
    setHistory((h) => {
      const next = typeof updater === 'function' ? (updater as (s: EditorState) => EditorState)(h.present) : updater;

      if (next === h.present) return h;

      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      const previous = h.past.at(-1);

      if (previous === undefined) return h;

      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;

      const [next, ...rest] = h.future;

      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
