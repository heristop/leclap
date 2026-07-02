import type { TFunction } from 'i18next';
import { getButtonLabel, isCompileDisabled } from '@/src/features/templates/detail/button-label';

// Identity `t` so the label keys are asserted directly.
const t = ((key: string) => key) as unknown as TFunction<'detail'>;

describe('getButtonLabel', () => {
  it('is the create label when idle', () => {
    expect(getButtonLabel(false, false, t)).toBe('button.create');
    expect(getButtonLabel(false, true, t)).toBe('button.create');
  });

  it('morphs while pending, by queue mode', () => {
    expect(getButtonLabel(true, false, t)).toBe('button.creating');
    expect(getButtonLabel(true, true, t)).toBe('button.addingToQueue');
  });
});

describe('isCompileDisabled', () => {
  it('is disabled unless everything is done and nothing is pending', () => {
    expect(isCompileDisabled(false, false)).toBe(true);
    expect(isCompileDisabled(true, true)).toBe(true);
    expect(isCompileDisabled(true, false)).toBe(false);
  });
});
