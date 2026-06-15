import { describe, expect, it } from 'vitest';
import { SECTION_CATEGORY, SECTION_ICON, SECTION_KINDS } from './sectionMeta';

describe('sectionMeta', () => {
  it('assigns every kind to a category and an icon', () => {
    for (const kind of SECTION_KINDS) {
      expect(SECTION_CATEGORY[kind]).toBeTruthy();
      expect(SECTION_ICON[kind]).toBeTruthy();
    }
  });

  it('groups clip & visuals, input, and data', () => {
    expect(SECTION_CATEGORY.video).toBe('clip');
    expect(SECTION_CATEGORY.color).toBe('clip');
    expect(SECTION_CATEGORY.image).toBe('clip');
    expect(SECTION_CATEGORY.form).toBe('input');
    expect(SECTION_CATEGORY.music).toBe('data');
    expect(SECTION_CATEGORY.partial).toBe('data');
  });
});
