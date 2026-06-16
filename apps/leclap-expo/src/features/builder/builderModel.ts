import type { TemplateDescriptor, Field } from '@/src/types';

/**
 * Pure state logic for the Builder wizard — ported from leclap-web's Builder page.
 * Keeping it framework-free means the step machine (which steps apply, when Next unlocks,
 * how the Configure step is skipped) is unit-tested without rendering anything. The screen
 * is a thin shell over these functions.
 */

export const BUILDER_STEPS = ['Template', 'Configure', 'Upload', 'Edit', 'Process', 'Result'] as const;

export type BuilderStep = (typeof BUILDER_STEPS)[number];

export const STEP_INDEX = {
  template: 0,
  configure: 1,
  upload: 2,
  edit: 3,
  process: 4,
  result: 5,
} as const;

const LAST_STEP = BUILDER_STEPS.length - 1;

/** All form fields declared by the template's `form` sections, flattened. */
export function templateFormFields(descriptor: TemplateDescriptor | null): Field[] {
  const sections = descriptor?.sections ?? [];

  return sections.filter((s) => s.type === 'form').flatMap((s) => s.options?.fields ?? []);
}

/** Whether the template defines any form fields — drives skipping the Configure step. */
export function hasFormFields(descriptor: TemplateDescriptor | null): boolean {
  return templateFormFields(descriptor).length > 0;
}

/** How many recorded/picked clips the template expects (one per `project_video` section). */
export function requiredClipCount(descriptor: TemplateDescriptor | null): number {
  return (descriptor?.sections ?? []).filter((s) => s.type === 'project_video').length;
}

/** A template with no form fields is trivially complete; otherwise every field must be filled. */
export function isFormComplete(descriptor: TemplateDescriptor | null, formData: Record<string, string>): boolean {
  if (!descriptor) {
    return false;
  }

  const fields = templateFormFields(descriptor);

  if (fields.length === 0) {
    return true;
  }

  return fields.every((field) => (formData[field.name] ?? '').trim() !== '');
}

/** Which step machine choices a template makes: it skips Configure with no form, and skips
 * Upload + Edit with no clips (e.g. the premium color/text cards, which need no recording). */
export interface StepFlow {
  hasForm: boolean;
  hasClips: boolean;
}

/** Step indices that don't apply to this template, so navigation hops over them in both directions. */
function skippedSteps({ hasForm, hasClips }: StepFlow): Set<number> {
  const skipped = new Set<number>();

  if (!hasForm) {
    skipped.add(STEP_INDEX.configure);
  }

  if (!hasClips) {
    skipped.add(STEP_INDEX.upload);
    skipped.add(STEP_INDEX.edit);
  }

  return skipped;
}

/** Next applicable step, hopping over Configure/Upload/Edit the template doesn't use. Clamped to last. */
export function nextStepIndex(current: number, opts: StepFlow): number {
  const skipped = skippedSteps(opts);
  let target = current + 1;

  while (target < LAST_STEP && skipped.has(target)) {
    target += 1;
  }

  return Math.min(target, LAST_STEP);
}

/** Previous applicable step, hopping over Configure/Upload/Edit the template doesn't use. Clamped to 0. */
export function prevStepIndex(current: number, opts: StepFlow): number {
  const skipped = skippedSteps(opts);
  let target = current - 1;

  while (target > 0 && skipped.has(target)) {
    target -= 1;
  }

  return Math.max(target, 0);
}

export interface BuilderGateState {
  hasTemplate: boolean;
  isFormComplete: boolean;
  clipCount: number;
}

/** Whether the "Next" affordance is enabled for the current step. */
export function canAdvance(current: number, state: BuilderGateState): boolean {
  if (current === STEP_INDEX.template) {
    return state.hasTemplate;
  }

  if (current === STEP_INDEX.configure) {
    return state.isFormComplete;
  }

  if (current === STEP_INDEX.upload) {
    return state.clipCount > 0;
  }

  // Edit / Process / Result are not gated by Next (Process triggers the compile itself).
  return true;
}

/** Where "Back" from the Result step lands — the first input step the template actually uses,
 * falling back to Process when it collects neither form input nor clips (e.g. the premium cards). */
export function resultBackStep(opts: StepFlow): number {
  if (opts.hasForm) {
    return STEP_INDEX.configure;
  }

  if (opts.hasClips) {
    return STEP_INDEX.upload;
  }

  return STEP_INDEX.process;
}
