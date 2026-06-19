import { useReducer } from 'react';
import type { EditorToolId } from './editorTools';

export interface SelectionState {
  activeTool: EditorToolId;
  selectedIndex: number;
}

export type SelectionAction =
  | { type: 'selectScene'; index: number }
  | { type: 'selectTool'; tool: EditorToolId }
  | { type: 'clamp'; count: number };

// Pure transitions for the shell's "what am I looking at" state: which dock tool is active and which
// section is selected. `clamp` keeps the selection valid after add/remove/reorder.
export const editorSelectionReducer = (state: SelectionState, action: SelectionAction): SelectionState => {
  if (action.type === 'selectScene') {
    return { activeTool: 'scenes', selectedIndex: action.index };
  }

  if (action.type === 'selectTool') {
    return { ...state, activeTool: action.tool };
  }

  const lastValid = action.count > 0 ? action.count - 1 : 0;

  return { ...state, selectedIndex: Math.min(state.selectedIndex, lastValid) };
};

export const useEditorSelection = (initial: SelectionState) => useReducer(editorSelectionReducer, initial);
