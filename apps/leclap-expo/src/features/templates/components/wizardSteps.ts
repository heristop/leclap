// Pure wizard-step model for the create-template flow: three steps (Info, Scenes, Style & Audio)
// with per-step validation. No React/RN dependency — unit-tested in wizardSteps.test.ts.
import type { EditorState } from '../model/templateEditorModel';

export type WizardStep = 'info' | 'scenes' | 'style';

export const WIZARD_STEPS: WizardStep[] = ['info', 'scenes', 'style'];

// Per-step i18n keys (editor namespace). Kept as literal unions so the typed-key augmentation can
// check them — a templated `wizard.${step}.title` would defeat that compile-time safety.
export const STEP_TITLE_KEY: Record<WizardStep, 'wizard.info.title' | 'wizard.scenes.title' | 'wizard.style.title'> = {
  info: 'wizard.info.title',
  scenes: 'wizard.scenes.title',
  style: 'wizard.style.title',
};

export const STEP_SUBTITLE_KEY: Record<
  WizardStep,
  'wizard.info.subtitle' | 'wizard.scenes.subtitle' | 'wizard.style.subtitle'
> = {
  info: 'wizard.info.subtitle',
  scenes: 'wizard.scenes.subtitle',
  style: 'wizard.style.subtitle',
};

// A visual scene is anything that can carry a transition after it (everything but music).
export function isVisualKind(kind: EditorState['sections'][number]['kind']): boolean {
  return kind !== 'music';
}

// Index of the last visual section — the boundary after it never gets a transition.
// Returns -1 when there are no visual sections.
export function lastVisualIndex(state: EditorState): number {
  let last = -1;

  for (let i = 0; i < state.sections.length; i += 1) {
    if (isVisualKind(state.sections[i].kind)) last = i;
  }

  return last;
}

// Whether a given step's required inputs are satisfied. The Info step needs a non-blank name;
// the Scenes step needs at least one section; Style has no hard requirement.
export function isStepValid(step: WizardStep, state: EditorState): boolean {
  if (step === 'info') return state.name.trim() !== '';

  if (step === 'scenes') return state.sections.length > 0;

  return true;
}

// The first reason the template can't be saved yet, or null when it's ready. Used to block the
// final save and point the user at the offending step. `messageKey` is an i18n key under the
// `editor` namespace's `alerts` group so the screen can translate it.
export function saveBlocker(
  state: EditorState
): { step: WizardStep; messageKey: 'alerts.needName' | 'alerts.needScene' } | null {
  if (!isStepValid('info', state)) return { step: 'info', messageKey: 'alerts.needName' };

  if (!isStepValid('scenes', state)) return { step: 'scenes', messageKey: 'alerts.needScene' };

  return null;
}

// Index of a step in the ordered flow (for progress dots / next-prev).
export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}
