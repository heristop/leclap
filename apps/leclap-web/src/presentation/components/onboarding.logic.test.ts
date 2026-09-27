import { describe, expect, it } from 'vitest';
import type { OnboardingStep } from '@/hooks/useOnboardingCompile';
import { closesOnBackdrop, closesOnEscape, focusAfterClipPicked } from './onboarding.logic';

const STEPS: readonly OnboardingStep[] = ['welcome', 'create', 'compiling', 'done', 'error'];

describe('closesOnBackdrop', () => {
  it('lets a click beside the panel skip the intro before anything is at stake', () => {
    expect(closesOnBackdrop('welcome')).toBe(true);
    expect(closesOnBackdrop('create')).toBe(true);
  });

  it('keeps a stray click from closing a render or its outcome', () => {
    expect(closesOnBackdrop('compiling')).toBe(false);
    expect(closesOnBackdrop('done')).toBe(false);
    expect(closesOnBackdrop('error')).toBe(false);
  });
});

describe('closesOnEscape', () => {
  it('closes every step but the render in flight', () => {
    expect(STEPS.filter((step) => closesOnEscape(step))).toEqual(['welcome', 'create', 'done', 'error']);
  });

  it('leaves a render to its Stop button', () => {
    expect(closesOnEscape('compiling')).toBe(false);
  });
});

describe('focusAfterClipPicked', () => {
  it('leaves focus alone while it is still inside the dialog', () => {
    expect(focusAfterClipPicked({ focusInDialog: true, hasClip: true })).toBe('keep');
    expect(focusAfterClipPicked({ focusInDialog: true, hasClip: false })).toBe('keep');
  });

  it('hands lost focus to Create once there is a clip to create from', () => {
    expect(focusAfterClipPicked({ focusInDialog: false, hasClip: true })).toBe('create');
  });

  it('hands lost focus back to the control that opened the camera when no clip came back', () => {
    expect(focusAfterClipPicked({ focusInDialog: false, hasClip: false })).toBe('trigger');
  });
});
