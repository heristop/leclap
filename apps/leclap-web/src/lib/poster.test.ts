import { describe, expect, it } from 'vitest';
import type { TemplateDescriptor } from '@/services/templateService';
import { coverGradient, templatePoster } from './poster';

const descriptor = (sections: { type: string }[] | undefined): TemplateDescriptor =>
  ({ sections }) as unknown as TemplateDescriptor;

describe('coverGradient', () => {
  it('is deterministic for the same seed', () => {
    expect(coverGradient('arcadia')).toBe(coverGradient('arcadia'));
  });

  it('differs across seeds', () => {
    expect(coverGradient('a')).not.toBe(coverGradient('b'));
  });
});

describe('templatePoster', () => {
  it('caps glyphs at six and preserves order', () => {
    const sections = Array.from({ length: 8 }, () => ({ type: 'project_video' }));
    expect(templatePoster('id', descriptor(sections)).glyphs).toHaveLength(6);
  });

  it('counts the scenes the strip leaves out', () => {
    const sections = Array.from({ length: 8 }, () => ({ type: 'project_video' }));
    expect(templatePoster('id', descriptor(sections)).more).toBe(2);
    expect(templatePoster('id', descriptor(sections.slice(0, 4))).more).toBe(0);
  });

  it('handles a descriptor with no sections', () => {
    const poster = templatePoster('id', descriptor(undefined));
    expect(poster.glyphs).toEqual([]);
    expect(typeof poster.gradient).toBe('string');
  });

  it('maps section types to kinds', () => {
    const poster = templatePoster('id', descriptor([{ type: 'form' }, { type: 'project_video' }]));
    expect(poster.glyphs).toEqual(['form', 'video']);
  });
});
