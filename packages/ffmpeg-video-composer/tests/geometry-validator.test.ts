import { describe, it, expect } from 'vitest';
import { TemplateValidator } from '@/services/TemplateValidator';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

const overflowing = {
  global: { orientation: 'landscape' },
  sections: [
    {
      type: 'color_background',
      name: 'a',
      options: { duration: 4 },
      caption: { text: 'An extremely long caption that cannot possibly fit', fontsize: 90 },
    },
  ],
} as unknown as TemplateDescriptor;

describe('TemplateValidator geometry channel', () => {
  it('reports geometry warnings through its own method', async () => {
    const warnings = await new TemplateValidator().getGeometryWarnings(overflowing);

    expect(warnings.length).toBeGreaterThan(0);
  });

  it('leaves validateTemplate success untouched', () => {
    // The descriptor is schema-valid; only its geometry is questionable. `success` must not change,
    // or every downstream exit code and CI gate shifts meaning.
    const result = new TemplateValidator().validateTemplate(overflowing);

    expect(result.errors ?? []).not.toContainEqual(expect.objectContaining({ code: 'text_overflow' }));
  });
});
