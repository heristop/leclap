// Template identity (name/description) must ride inside the descriptor itself so an exported JSON
// stays self-describing: buildDescriptor emits meta { name, description } (pruned when blank) and
// toEditorState prefers descriptor.meta over the wrapping EditableTemplate fields, so an imported
// descriptor brings its own identity along.
import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  newSection,
  toEditorState,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditableTemplate,
  type TemplateDescriptor,
  type EditorState,
} from '../src/editor/templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

function metaState(over: Partial<EditorState> = {}): EditorState {
  return {
    id: 'user-1',
    name: 'Holiday Promo',
    description: 'A festive teaser',
    orientation: 'landscape',
    sections: [newSection('video')],
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
    globalAnimations: [],
    globalOverlays: [],
    ...over,
  };
}

// A wrapper whose own name/description are STALE, to prove descriptor.meta wins on re-hydration.
function asTemplate(descriptor: TemplateDescriptor): EditableTemplate {
  return { id: 'user-1', name: 'stale wrapper name', description: 'stale wrapper blurb', orientation: 'landscape', descriptor };
}

describe('descriptor meta round-trip', () => {
  it('emits meta.name and meta.description from the editor state, and validates', () => {
    const descriptor = buildDescriptor(metaState());

    expect(() => TemplateDescriptorSchema.parse(descriptor)).not.toThrow();
    expect(descriptor.meta).toEqual({ name: 'Holiday Promo', description: 'A festive teaser' });
  });

  it('emits no meta key at all when both name and description are blank', () => {
    const descriptor = buildDescriptor(metaState({ name: '', description: '   ' }));

    expect(descriptor.meta).toBeUndefined();
    expect('meta' in descriptor).toBe(false);
  });

  it('prunes the blank half: name-only and description-only descriptors stay minimal', () => {
    const nameOnly = buildDescriptor(metaState({ description: '' }));
    expect(nameOnly.meta).toEqual({ name: 'Holiday Promo' });

    const descriptionOnly = buildDescriptor(metaState({ name: '  ' }));
    expect(descriptionOnly.meta).toEqual({ description: 'A festive teaser' });
  });

  it('trims whitespace padding off the emitted fields', () => {
    const descriptor = buildDescriptor(metaState({ name: '  Holiday Promo  ', description: ' A festive teaser ' }));

    expect(descriptor.meta).toEqual({ name: 'Holiday Promo', description: 'A festive teaser' });
  });

  it('re-hydrates name/description from descriptor.meta, preferring it over the wrapper', () => {
    const back = toEditorState(asTemplate(buildDescriptor(metaState())));

    expect(back.name).toBe('Holiday Promo');
    expect(back.description).toBe('A festive teaser');
  });

  it('falls back to the wrapper fields when the descriptor carries no meta (legacy JSON)', () => {
    const legacy: TemplateDescriptor = { global: { orientation: 'landscape' }, sections: [] };
    const back = toEditorState(asTemplate(legacy));

    expect(back.name).toBe('stale wrapper name');
    expect(back.description).toBe('stale wrapper blurb');
  });

  it('falls back per-field: a name-only meta still takes the wrapper description', () => {
    const descriptor = buildDescriptor(metaState({ description: '' }));
    const back = toEditorState(asTemplate(descriptor));

    expect(back.name).toBe('Holiday Promo');
    expect(back.description).toBe('stale wrapper blurb');
  });

  it('survives the full build -> toEditorState -> build round-trip unchanged', () => {
    const first = buildDescriptor(metaState());
    const second = buildDescriptor(toEditorState(asTemplate(first)));

    expect(second).toEqual(first);
  });
});
