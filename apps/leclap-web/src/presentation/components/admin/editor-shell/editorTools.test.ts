import { describe, it, expect } from 'vitest';
import { buildEditorTools, type EditorToolId } from './editorTools';

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
