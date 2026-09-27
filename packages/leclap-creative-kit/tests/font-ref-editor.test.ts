import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  fontIdFromFile,
  fontLabel,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
} from '../src/editor/templateEditorModel';
import { DEFAULT_FONT_ID } from '../src/fonts';

type VideoSection = Extract<EditorSection, { kind: 'video' }>;

const inter = { family: 'Inter', weight: 700 };

const stateWith = (overrides: Partial<EditorState> = {}): EditorState => ({
  id: makeTemplateId(),
  name: 'Font ref test',
  description: '',
  orientation: 'landscape',
  sections: [newSection('video')],
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { ...DEFAULT_TRANSITION },
  globalAnimations: [],
  globalOverlays: [],
  ...overrides,
});

const templateFrom = (state: EditorState) => ({
  id: state.id,
  name: state.name,
  description: state.description,
  orientation: state.orientation,
  descriptor: buildDescriptor(state),
});

// Editor summaries name the face the render draws — never "[object Object]" for a font named by family.
describe('fontLabel', () => {
  it('uses the registry label for a curated id', () => {
    expect(fontLabel('bebas')).toBe('Bebas Neue');
  });

  it('names a font by family with its weight and style', () => {
    expect(fontLabel({ family: 'Inter' })).toBe('Inter');
    expect(fontLabel({ family: 'Playfair Display', weight: 700, style: 'italic' })).toBe('Playfair Display 700 italic');
  });

  it('keeps any other value as typed', () => {
    expect(fontLabel('Quicksand.ttf')).toBe('Quicksand.ttf');
  });
});

describe('fontIdFromFile', () => {
  it('maps a registry file to its id and anything else to the default', () => {
    expect(fontIdFromFile('BebasNeue.ttf')).toBe('bebas');
    expect(fontIdFromFile('Quicksand.ttf')).toBe(DEFAULT_FONT_ID);
    expect(fontIdFromFile(undefined)).toBe(DEFAULT_FONT_ID);
    expect(fontIdFromFile(inter)).toBe(DEFAULT_FONT_ID);
  });
});

// The editor carries a font named by family through untouched, so opening and re-saving a template
// keeps it — the pickers only replace it when another font is chosen.
describe('font named by family round trip', () => {
  it('keeps a caption font ref through toEditorState and back', () => {
    const section = { ...(newSection('video') as VideoSection), caption: { text: 'Hello', font: inter } };
    const back = toEditorState(templateFrom(stateWith({ sections: [section] })));

    expect((back.sections[0] as VideoSection).caption?.font).toEqual(inter);
    expect(buildDescriptor(back).sections?.[0]?.caption?.font).toEqual(inter);
  });
});
