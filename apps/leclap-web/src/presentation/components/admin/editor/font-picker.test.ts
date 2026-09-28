import { describe, it, expect } from 'vitest';
import { FONT_REF_OPTION, fontPickerValue } from './font-picker';

describe('fontPickerValue', () => {
  it('selects a registry id as-is and falls back when unset', () => {
    expect(fontPickerValue('bebas', '__default__')).toBe('bebas');
    expect(fontPickerValue(undefined, '__default__')).toBe('__default__');
  });

  // A font named by family is not in the curated list: it gets its own option, so the trigger does
  // not claim "Default" and picking the default (or any font) is a real change.
  it('gives a font named by family its own option', () => {
    expect(fontPickerValue({ family: 'Inter' }, '__default__')).toBe(FONT_REF_OPTION);
  });
});
