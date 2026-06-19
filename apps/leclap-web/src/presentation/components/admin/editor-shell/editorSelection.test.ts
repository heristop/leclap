import { describe, it, expect } from 'vitest';
import { editorSelectionReducer, type SelectionState } from './useEditorSelection';

const initial: SelectionState = { activeTool: 'scenes', selectedIndex: 0 };

describe('editorSelectionReducer', () => {
  it('selecting a scene focuses it and switches to the scenes tool', () => {
    expect(
      editorSelectionReducer({ activeTool: 'basics', selectedIndex: 2 }, { type: 'selectScene', index: 1 })
    ).toEqual<SelectionState>({ activeTool: 'scenes', selectedIndex: 1 });
  });
  it('switching tool keeps the selected scene', () => {
    expect(editorSelectionReducer(initial, { type: 'selectTool', tool: 'audio' })).toEqual<SelectionState>({
      activeTool: 'audio',
      selectedIndex: 0,
    });
  });
  it('clamps the selected index after a section is removed', () => {
    expect(
      editorSelectionReducer({ activeTool: 'scenes', selectedIndex: 3 }, { type: 'clamp', count: 2 }).selectedIndex
    ).toBe(1);
  });
  it('clamp on an empty list parks selection at 0', () => {
    expect(
      editorSelectionReducer({ activeTool: 'scenes', selectedIndex: 2 }, { type: 'clamp', count: 0 }).selectedIndex
    ).toBe(0);
  });
});
