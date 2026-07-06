import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  toEditorState,
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type AnimationOverlay,
} from '../src/editor/templateEditorModel';

const stateWith = (overrides: Partial<EditorState> = {}): EditorState => ({
  id: makeTemplateId(),
  name: 'Global animation motion test',
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

describe('whole-video animation motion (entrance)', () => {
  const animated: AnimationOverlay = {
    id: 'a1',
    url: '/assets/animations/glow_border.apng',
    position: '10:20',
    motion: { type: 'rise', delay: 0.2, duration: 0.8, distance: 40, easing: 'ease-out' },
  };

  it('emits motion on the global.animations descriptor entry', () => {
    const anim = buildDescriptor(stateWith({ globalAnimations: [animated] })).global?.animations?.[0];

    expect(anim).toMatchObject({
      url: animated.url,
      position: '10:20',
      motion: { type: 'rise', delay: 0.2, duration: 0.8, distance: 40, easing: 'ease-out' },
    });
  });

  it('round-trips motion through toEditorState (bare type and full object)', () => {
    const bare: AnimationOverlay = { id: 'a2', url: '/assets/animations/light_leak.apng', motion: 'fade' };
    const back = toEditorState(templateFrom(stateWith({ globalAnimations: [animated, bare] })));

    expect(back.globalAnimations).toHaveLength(2);
    expect(back.globalAnimations[0].motion).toEqual(animated.motion);
    expect(back.globalAnimations[1].motion).toBe('fade');
  });

  it('emits no motion key when the entrance is unset', () => {
    const plain: AnimationOverlay = { id: 'a3', url: '/assets/animations/glow_border.apng' };
    const anim = buildDescriptor(stateWith({ globalAnimations: [plain] })).global?.animations?.[0];

    expect(anim).not.toHaveProperty('motion');
  });
});
