import { describe, it, expect } from 'vitest';
import { buildEditorTools, nextTool, prevTool, type EditorToolId } from './editorTools';

describe('buildEditorTools', () => {
  it('always offers scenes, basics, audio', () => {
    expect(buildEditorTools({ advanced: false }).map((t) => t.id)).toEqual<EditorToolId[]>([
      'scenes',
      'basics',
      'audio',
    ]);
  });
  it('adds variables + advanced only in advanced mode', () => {
    expect(buildEditorTools({ advanced: true }).map((t) => t.id)).toEqual<EditorToolId[]>([
      'scenes',
      'basics',
      'audio',
      'variables',
      'advanced',
    ]);
  });
  it('gives every tool a label key and icon', () => {
    for (const tool of buildEditorTools({ advanced: true })) {
      expect(tool.labelKey.length).toBeGreaterThan(0);
      expect(tool.icon).toBeTruthy();
    }
  });
});

describe('nextTool / prevTool', () => {
  const tools = buildEditorTools({ advanced: true });

  it('cycles forward and wraps at the end', () => {
    expect(nextTool(tools, 'scenes')).toBe('basics');
    expect(nextTool(tools, 'advanced')).toBe('scenes');
  });
  it('cycles backward and wraps at the start', () => {
    expect(prevTool(tools, 'basics')).toBe('scenes');
    expect(prevTool(tools, 'scenes')).toBe('advanced');
  });
  it('falls back to the first tool when current is absent', () => {
    expect(nextTool(tools, 'variables' as EditorToolId)).toBe('advanced');
    expect(nextTool(buildEditorTools({ advanced: false }), 'variables')).toBe('scenes');
  });
});
