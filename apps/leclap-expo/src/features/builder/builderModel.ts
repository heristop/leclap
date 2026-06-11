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

/** Next step, skipping Configure (index 1) when the template has no form fields. Clamped to last. */
export function nextStepIndex(current: number, opts: { hasForm: boolean }): number {
  const next = current + 1;
  const target = next === STEP_INDEX.configure && !opts.hasForm ? next + 1 : next;

  return Math.min(target, LAST_STEP);
}

/** Previous step, skipping Configure (index 1) when the template has no form fields. Clamped to 0. */
export function prevStepIndex(current: number, opts: { hasForm: boolean }): number {
  const back = current - 1;
  const target = back === STEP_INDEX.configure && !opts.hasForm ? back - 1 : back;

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

/** Where "Back" from the Result step lands: Configure if the template has a form, else Upload. */
export function resultBackStep(opts: { hasForm: boolean }): number {
  return opts.hasForm ? STEP_INDEX.configure : STEP_INDEX.upload;
}
