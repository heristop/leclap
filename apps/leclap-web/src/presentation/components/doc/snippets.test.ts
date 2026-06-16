import { describe, it, expect } from 'vitest';
import { SectionSchema, TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { snippets } from './snippets';

// Section-shaped samples validate against one section; descriptor-shaped ones against the whole
// document. Parsing each against the engine's own schema keeps the docs' samples from drifting.
const sectionKeys = [
  'section',
  'look',
  'grade',
  'motion',
  'framingGuide',
  'layers',
  'audioFade',
  'caption',
  'filters',
  'maps',
] as const;
const descriptorKeys = ['transition', 'audio'] as const;

describe('doc snippets', () => {
  it('section samples validate against SectionSchema', () => {
    for (const key of sectionKeys) {
      const parsed = SectionSchema.safeParse(JSON.parse(snippets[key]));
      expect(parsed.success, `${key}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('descriptor samples validate against TemplateDescriptorSchema', () => {
    for (const key of descriptorKeys) {
      const parsed = TemplateDescriptorSchema.safeParse(JSON.parse(snippets[key]));
      expect(parsed.success, `${key}: ${parsed.error?.message}`).toBe(true);
    }
  });
});
