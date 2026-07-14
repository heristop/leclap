import { describe, it, expect } from 'vitest';
import { compileGlobalDecorations, type SugarContext } from '@/editor/presets/registry';
import type { Section, TemplateDescriptorGlobal } from '@/core/types';

// ---------------------------------------------------------------------------
// compileGlobalDecorations — per-field, wholesale override of global look/grade.
//
// A section that defines its OWN grade (or look) must NOT also receive the global
// grade (or look): otherwise the section is double-graded. The override is per-field
// and independent — a section can override grade while still inheriting the global
// look, and vice-versa.
// ---------------------------------------------------------------------------

const ctx: SugarContext = { duration: 5, scale: '1280:720', fps: 30, isVideo: false };

const section = (overrides: Partial<Section> = {}): Section =>
  ({ name: 'intro', type: 'image', ...overrides }) as Section;

const gradeValues = (filters: { type: string; value?: string }[]): string[] =>
  filters.filter((f) => f.type === 'eq').map((f) => f.value ?? '');

const hasLut = (filters: { type: string; value?: string }[]): boolean =>
  filters.some((f) => f.type === 'lut3d');

describe('compileGlobalDecorations look/grade override', () => {
  it('applies the global grade to a section that has no grade of its own', () => {
    const global: TemplateDescriptorGlobal = { grade: { contrast: 1.2, saturation: 1.3 } };

    const { background } = compileGlobalDecorations(global, section(), ctx);

    expect(gradeValues(background)).toContain('contrast=1.2:saturation=1.3');
  });

  it('suppresses the global grade for a section that defines its own grade', () => {
    const global: TemplateDescriptorGlobal = { grade: { contrast: 1.2, saturation: 1.3 } };

    const { background } = compileGlobalDecorations(global, section({ grade: { contrast: 1.05 } }), ctx);

    // The section's own grade is compiled by compileSugarLayers, not here — so the
    // global decoration for this section must emit NO grade filter at all.
    expect(gradeValues(background)).toHaveLength(0);
    expect(gradeValues(background)).not.toContain('contrast=1.2:saturation=1.3');
  });

  it('applies the global look to a section that has no look of its own', () => {
    const global: TemplateDescriptorGlobal = { look: 'teal-orange' };

    const { background } = compileGlobalDecorations(global, section(), ctx);

    expect(hasLut(background)).toBe(true);
  });

  it('suppresses the global look for a section that defines its own look', () => {
    const global: TemplateDescriptorGlobal = { look: 'teal-orange' };

    const { background } = compileGlobalDecorations(global, section({ look: 'noir' }), ctx);

    expect(hasLut(background)).toBe(false);
    expect(background).toHaveLength(0);
  });

  it('overrides grade and look independently', () => {
    const global: TemplateDescriptorGlobal = { grade: { contrast: 1.2 }, look: 'teal-orange' };

    // Section overrides grade only → keeps global look, drops global grade.
    const gradeOverridden = compileGlobalDecorations(global, section({ grade: { contrast: 1.05 } }), ctx).background;
    expect(gradeValues(gradeOverridden)).toHaveLength(0);
    expect(hasLut(gradeOverridden)).toBe(true);

    // Section overrides look only → keeps global grade, drops global look.
    const lookOverridden = compileGlobalDecorations(global, section({ look: 'noir' }), ctx).background;
    expect(gradeValues(lookOverridden)).toContain('contrast=1.2');
    expect(hasLut(lookOverridden)).toBe(false);
  });

  it('emits nothing for a global that defines neither grade nor look', () => {
    const { background, overlay } = compileGlobalDecorations({}, section(), ctx);

    expect(background).toHaveLength(0);
    expect(overlay).toHaveLength(0);
  });
});
