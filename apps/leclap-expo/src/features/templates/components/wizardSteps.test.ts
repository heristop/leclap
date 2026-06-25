import { DEFAULT_AUDIO_MIX, newSection, type EditorState } from '../model/templateEditorModel';
import { isStepValid, saveBlocker, lastVisualIndex, isVisualKind, stepIndex, WIZARD_STEPS } from './wizardSteps';

const baseState = (over: Partial<EditorState> = {}): EditorState => ({
  id: 'user-test',
  name: 'My template',
  description: '',
  orientation: 'landscape',
  sections: [newSection('video')],
  globalVariables: [],
  audio: { ...DEFAULT_AUDIO_MIX },
  defaultTransition: { type: 'cut', duration: 0.5 },
  globalOverlays: [],
  globalAnimations: [],
  ...over,
});

describe('isStepValid', () => {
  it('info requires a non-blank name', () => {
    expect(isStepValid('info', baseState({ name: '  ' }))).toBe(false);
    expect(isStepValid('info', baseState({ name: 'Hi' }))).toBe(true);
  });

  it('scenes requires at least one section', () => {
    expect(isStepValid('scenes', baseState({ sections: [] }))).toBe(false);
    expect(isStepValid('scenes', baseState())).toBe(true);
  });

  it('style is always valid', () => {
    expect(isStepValid('style', baseState({ name: '', sections: [] }))).toBe(true);
  });
});

describe('saveBlocker', () => {
  it('blocks on a missing name first', () => {
    expect(saveBlocker(baseState({ name: '' }))).toEqual({ step: 'info', messageKey: 'alerts.needName' });
  });

  it('blocks on no scenes', () => {
    expect(saveBlocker(baseState({ sections: [] }))).toEqual({ step: 'scenes', messageKey: 'alerts.needScene' });
  });

  it('returns null when ready', () => {
    expect(saveBlocker(baseState())).toBeNull();
  });
});

describe('lastVisualIndex / isVisualKind', () => {
  it('music is not visual; the others are', () => {
    expect(isVisualKind('music')).toBe(false);
    expect(isVisualKind('video')).toBe(true);
    expect(isVisualKind('color')).toBe(true);
  });

  it('finds the last non-music section', () => {
    const state = baseState({
      sections: [newSection('video'), newSection('color'), newSection('music')],
    });

    expect(lastVisualIndex(state)).toBe(1);
  });

  it('returns -1 when there are no visual sections', () => {
    expect(lastVisualIndex(baseState({ sections: [newSection('music')] }))).toBe(-1);
  });
});

describe('stepIndex / WIZARD_STEPS', () => {
  it('orders the three steps', () => {
    expect(WIZARD_STEPS).toEqual(['info', 'scenes', 'style']);
    expect(stepIndex('scenes')).toBe(1);
  });
});
