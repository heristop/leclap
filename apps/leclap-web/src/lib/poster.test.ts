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
  it('caps glyphs at five and preserves order', () => {
    const sections = Array.from({ length: 8 }, () => ({ type: 'project_video' }));
    expect(templatePoster('id', descriptor(sections)).glyphs).toHaveLength(5);
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
