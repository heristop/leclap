import {
  BUILDER_STEPS,
  STEP_INDEX,
  templateFormFields,
  hasFormFields,
  requiredClipCount,
  isFormComplete,
  nextStepIndex,
  prevStepIndex,
  canAdvance,
  resultBackStep,
} from './builderModel';
import type { TemplateDescriptor } from '@/src/types';

const formField = (name: string) => ({ name, maxLength: 40, label: { en: name } });

const descriptorWithForm: TemplateDescriptor = {
  global: { orientation: 'portrait' },
  sections: [
    { name: 'form_1', type: 'form', options: { fields: [formField('firstname'), formField('lastname')] } },
    { name: 'video_1', type: 'project_video', options: { duration: 8 } },
  ],
};

const descriptorNoForm: TemplateDescriptor = {
  global: { orientation: 'landscape' },
  sections: [
    { name: 'video_1', type: 'project_video', options: { duration: 8 } },
    { name: 'video_2', type: 'project_video', options: { duration: 4 } },
    { name: 'color_1', type: 'color_background', options: { duration: 3 } },
  ],
};

describe('builderModel descriptor queries', () => {
  it('flattens form fields and detects their presence', () => {
    expect(templateFormFields(descriptorWithForm).map((f) => f.name)).toEqual(['firstname', 'lastname']);
    expect(hasFormFields(descriptorWithForm)).toBe(true);
    expect(hasFormFields(descriptorNoForm)).toBe(false);
    expect(hasFormFields(null)).toBe(false);
  });

  it('counts one required clip per project_video section', () => {
    expect(requiredClipCount(descriptorWithForm)).toBe(1);
    expect(requiredClipCount(descriptorNoForm)).toBe(2);
    expect(requiredClipCount(null)).toBe(0);
  });
});

describe('isFormComplete', () => {
  it('is false without a template, true when there are no fields', () => {
    expect(isFormComplete(null, {})).toBe(false);
    expect(isFormComplete(descriptorNoForm, {})).toBe(true);
  });

  it('requires every field to be non-empty (trimmed)', () => {
    expect(isFormComplete(descriptorWithForm, { firstname: 'Ada' })).toBe(false);
    expect(isFormComplete(descriptorWithForm, { firstname: 'Ada', lastname: '   ' })).toBe(false);
    expect(isFormComplete(descriptorWithForm, { firstname: 'Ada', lastname: 'Lovelace' })).toBe(true);
  });
});

describe('step navigation', () => {
  it('skips the Configure step when the template has no form fields', () => {
    // Template (0) -> Upload (2), skipping Configure (1)
    expect(nextStepIndex(STEP_INDEX.template, { hasForm: false })).toBe(STEP_INDEX.upload);
    // Upload (2) -> Configure-skip back to Template (0)
    expect(prevStepIndex(STEP_INDEX.upload, { hasForm: false })).toBe(STEP_INDEX.template);
  });

  it('visits the Configure step when the template has form fields', () => {
    expect(nextStepIndex(STEP_INDEX.template, { hasForm: true })).toBe(STEP_INDEX.configure);
    expect(prevStepIndex(STEP_INDEX.upload, { hasForm: true })).toBe(STEP_INDEX.configure);
  });

  it('clamps at the first and last steps', () => {
    expect(prevStepIndex(STEP_INDEX.template, { hasForm: true })).toBe(STEP_INDEX.template);
    expect(nextStepIndex(STEP_INDEX.result, { hasForm: true })).toBe(STEP_INDEX.result);
    expect(BUILDER_STEPS[STEP_INDEX.result]).toBe('Result');
  });
});

describe('canAdvance gating', () => {
  const base = { hasTemplate: true, isFormComplete: true, clipCount: 1 };

  it('blocks Template step until a template is chosen', () => {
    expect(canAdvance(STEP_INDEX.template, { ...base, hasTemplate: false })).toBe(false);
    expect(canAdvance(STEP_INDEX.template, base)).toBe(true);
  });

  it('blocks Configure step until the form is complete', () => {
    expect(canAdvance(STEP_INDEX.configure, { ...base, isFormComplete: false })).toBe(false);
    expect(canAdvance(STEP_INDEX.configure, base)).toBe(true);
  });

  it('blocks Upload step until at least one clip exists', () => {
    expect(canAdvance(STEP_INDEX.upload, { ...base, clipCount: 0 })).toBe(false);
    expect(canAdvance(STEP_INDEX.upload, base)).toBe(true);
  });

  it('does not gate Edit/Process/Result', () => {
    expect(canAdvance(STEP_INDEX.edit, { hasTemplate: false, isFormComplete: false, clipCount: 0 })).toBe(true);
    expect(canAdvance(STEP_INDEX.process, base)).toBe(true);
  });
});

describe('resultBackStep', () => {
  it('returns to Configure when there is a form, otherwise Upload', () => {
    expect(resultBackStep({ hasForm: true })).toBe(STEP_INDEX.configure);
    expect(resultBackStep({ hasForm: false })).toBe(STEP_INDEX.upload);
  });
});
