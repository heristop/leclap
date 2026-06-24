import { describe, it, expect } from 'vitest';
import { buildDescriptor, newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import { exportDescriptorJson, exportFilename, importDescriptorJson } from './templateIO';

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

describe('exportFilename', () => {
  it('slugifies the template name', () => {
    expect(exportFilename(state({ name: 'Holiday Promo 2024!' }))).toBe('holiday-promo-2024.json');
  });

  it('falls back to template.json when the name is blank', () => {
    expect(exportFilename(state({ name: '   ' }))).toBe('template.json');
  });
});

describe('import/export round-trip', () => {
  it('exports the built descriptor as pretty JSON', () => {
    const json = exportDescriptorJson(state());
    expect(json).toContain('\n  '); // pretty-printed
    expect(JSON.parse(json)).toEqual(buildDescriptor(state()));
  });

  it('re-imports an exported descriptor into an equivalent editor state', () => {
    const original = state();
    const json = exportDescriptorJson(original);

    const result = importDescriptorJson(json, original);
    expect(result.ok).toBe(true);

    if (!result.ok) return;

    // The descriptor the re-imported state builds must equal the original descriptor — a clean
    // round-trip through buildDescriptor -> JSON -> safeParse -> toEditorState -> buildDescriptor.
    expect(buildDescriptor(result.state)).toEqual(buildDescriptor(original));
    // Meta carried over from the current state.
    expect(result.state.id).toBe(original.id);
    expect(result.state.name).toBe(original.name);
    expect(result.state.orientation).toBe('portrait');
  });

  it('reports readable zod errors for an invalid descriptor', () => {
    const result = importDescriptorJson(JSON.stringify({ sections: [{ type: 'not_a_real_type' }] }), state());
    expect(result.ok).toBe(false);

    if (result.ok) return;

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((line) => line.includes(':'))).toBe(true);
  });

  it('reports a parse error for malformed JSON', () => {
    const result = importDescriptorJson('{ not json', state());
    expect(result.ok).toBe(false);

    if (result.ok) return;

    expect(result.errors[0]).toContain('Invalid JSON');
  });
});
