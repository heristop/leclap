import { describe, test, it, expect, beforeEach } from 'vitest';
import { TemplateValidator } from '@/services/TemplateValidator';
import {
  SectionSchema,
  TemplateDescriptorSchema,
  InputOptionsSchema,
  templateDescriptorJsonSchema,
  type TemplateDescriptor,
  type Section,
} from '@/schemas/template.schemas';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

function isTemplateDescriptor(data: TemplateDescriptor | Section): data is TemplateDescriptor {
  return !('type' in data);
}

function hasErrorCode(errors: Array<{ code: string }> | undefined, code: string): boolean {
  return errors?.some((err) => err.code === code) === true;
}

function assertVariableWarnings(validator: TemplateValidator, data: TemplateDescriptor | Section | undefined): void {
  if (data === undefined || !isTemplateDescriptor(data)) {
    return;
  }
  const warnings = validator.getVariableWarnings(data);
  expect(warnings.length).toBeGreaterThan(0);
  expect(warnings.some((err) => err.code === 'undefined_variable')).toBe(true);
  expect(warnings.some((err) => err.message.includes('undefinedVar'))).toBe(true);
}

describe('Template Validation', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  const loadTemplate = (filename: string) => {
    const templatePath = join(currentDir, 'fixtures', filename);
    const templateContent = readFileSync(templatePath, 'utf-8');

    return JSON.parse(templateContent);
  };

  describe('Valid Templates', () => {
    test('should validate sample.json template', () => {
      const template = loadTemplate('sample.json');
      const result = validator.validateTemplate(template);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('should validate fast-and-curious.json template', () => {
      const template = loadTemplate('fast-and-curious.json');
      const result = validator.validateTemplate(template);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('should validate picture.json template', () => {
      const template = loadTemplate('picture.json');
      const result = validator.validateTemplate(template);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('should validate video.json template', () => {
      const template = loadTemplate('video.json');
      const result = validator.validateTemplate(template);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Section Type Validation', () => {
    test('should validate video section type', () => {
      const section = {
        name: 'test_video',
        type: 'video',
        options: {
          videoUrl: 'https://example.com/video.mp4',
          duration: 10,
        },
      };

      const result = validator.validateSection(section);
      expect(result.success).toBe(true);
    });

    test('should validate form section type', () => {
      const section = {
        name: 'test_form',
        type: 'form',
        title: { en: 'Test Form' },
        options: {
          fields: [
            {
              name: 'test_field',
              maxLength: 50,
              label: { en: 'Test Field' },
            },
          ],
        },
      };

      const result = validator.validateSection(section);
      expect(result.success).toBe(true);
    });

    test('should validate color_background section type', () => {
      const section = {
        name: 'test_bg',
        type: 'color_background',
        options: {
          backgroundColor: '#FF0000',
          duration: 5,
        },
      };

      const result = validator.validateSection(section);
      expect(result.success).toBe(true);
    });
  });

  describe('Variable Reference Validation', () => {
    test('should detect undefined variable references as warnings', () => {
      const template = {
        global: {
          variables: {
            color1: '#FFFFFF',
          },
        },
        sections: [
          {
            name: 'test',
            type: 'color_background',
            filters: [
              {
                type: 'drawtext',
                values: {
                  text: { en: 'Hello {{ undefinedVar }}' },
                  fontcolor: '{{ color1 }}',
                },
              },
            ],
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(true); // Template validation should pass

      // But variable warnings should be available
      assertVariableWarnings(validator, result.data);
    });

    test('should pass validation with all variables defined', () => {
      const template = {
        global: {
          variables: {
            color1: '#FFFFFF',
            userName: 'John',
          },
        },
        sections: [
          {
            name: 'test',
            type: 'color_background',
            filters: [
              {
                type: 'drawtext',
                values: {
                  text: { en: 'Hello {{ userName }}' },
                  fontcolor: '{{ color1 }}',
                },
              },
            ],
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Section Reference Validation', () => {
    test('should detect undefined section references', () => {
      const template = {
        sections: [
          {
            name: 'intro',
            type: 'video',
            options: {
              useVideoSection: 'nonexistent_section',
            },
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(hasErrorCode(result.errors, 'undefined_section_reference')).toBe(true);
    });

    test('should pass validation with valid section references', () => {
      const template = {
        sections: [
          {
            name: 'main_video',
            type: 'project_video',
          },
          {
            name: 'intro',
            type: 'video',
            options: {
              useVideoSection: 'main_video',
            },
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Data Validation', () => {
    test('should reject invalid section type', () => {
      const template = {
        sections: [
          {
            name: 'test',
            type: 'invalid_type',
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should reject invalid filter structure', () => {
      const template = {
        sections: [
          {
            name: 'test',
            type: 'video',
            filters: [
              {
                // missing required 'type' field
                value: 'some_value',
              },
            ],
          },
        ],
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should accept template variable URLs', () => {
      const template = {
        global: {
          music: {
            name: 'test',
            url: '{{ musicUrl }}', // Template variable URLs are now allowed
          },
        },
      };

      const result = validator.validateTemplate(template);
      expect(result.success).toBe(true);
    });
  });

  describe('JSON Parsing', () => {
    test('should handle invalid JSON', () => {
      const invalidJson = '{ "global": { invalid json }';
      const result = validator.validateTemplateFromJSON(invalidJson);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      const firstError = result.errors?.[0];
      expect(firstError?.code).toBe('json_parse_error');
    });

    test('should handle valid JSON', () => {
      const validJson = JSON.stringify({
        global: { orientation: 'landscape' },
        sections: [],
      });

      const result = validator.validateTemplateFromJSON(validJson);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Summary', () => {
    test('should provide success summary', () => {
      const template = { sections: [] };
      const result = validator.validateTemplate(template);
      const summary = validator.getValidationSummary(result);

      expect(summary).toBe('Template validation passed');
    });

    test('should provide error summary', () => {
      const template = { sections: [{ name: 'test', type: 'invalid' }] };
      const result = validator.validateTemplate(template);
      const summary = validator.getValidationSummary(result);

      expect(summary).toContain('Template validation failed');
      expect(summary).toContain('error');
    });
  });

  describe('Schema — transitions', () => {
    it('accepts a section transition with a valid xfade type', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', transition: { type: 'wipeleft', duration: 0.5 } });
      expect(r.success).toBe(true);
    });

    it('accepts cut as a valid transition type', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', transition: { type: 'cut' } });
      expect(r.success).toBe(true);
    });

    it('rejects unknown transition types', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', transition: { type: 'starwipe' } });
      expect(r.success).toBe(false);
    });

    it('rejects transition duration above 5', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', transition: { type: 'fade', duration: 10 } });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — strict options (removed fields)', () => {
    it('rejects the removed musicVolumeLevel field', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', options: { musicVolumeLevel: 0.4 } });
      expect(r.success).toBe(false);
    });

    it('accepts the renamed musicVolume field', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', options: { musicVolume: 0.4 } });
      expect(r.success).toBe(true);
    });

    it('accepts audioFade on section options', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        options: { audioFade: { in: { duration: 0.5 }, out: { duration: 0.3, curve: 'tri' } } },
      });
      expect(r.success).toBe(true);
    });
  });

  describe('Schema — look / grade / motion on sections', () => {
    it('accepts a valid look preset', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', look: 'cinematic' });
      expect(r.success).toBe(true);
    });

    it('rejects an unknown look preset', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', look: 'ultraviolet' });
      expect(r.success).toBe(false);
    });

    it('accepts a grade object', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        grade: { brightness: 0.1, contrast: 1.2, saturation: 1.5 },
      });
      expect(r.success).toBe(true);
    });

    it('accepts a motion array with kenburns', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        motion: [{ type: 'kenburns', direction: 'in', intensity: 1.2 }],
      });
      expect(r.success).toBe(true);
    });

    it('rejects kenburns intensity below 1.01', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        motion: [{ type: 'kenburns', intensity: 0.5 }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — input type animation', () => {
    it('accepts input with type animation', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        inputs: [{ name: 'anim', url: 'anim.zip', type: 'animation' }],
      });
      expect(r.success).toBe(true);
    });

    it('rejects input with unknown type', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        inputs: [{ name: 'anim', url: 'anim.zip', type: 'frame' }],
      });
      expect(r.success).toBe(false);
    });

    it('accepts animation input options with fps and position', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        inputs: [
          { name: 'anim', url: 'anim.zip', type: 'animation', options: { fps: 25, position: '0:0', loop: true } },
        ],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('Schema — global audio / transition', () => {
    it('accepts global.audio with sourceVolume and ducking', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audio: { sourceVolume: 0.8, musicVolume: 0.4, ducking: true } },
        sections: [],
      });
      expect(r.success).toBe(true);
    });

    it('accepts global.transition object', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { transition: { type: 'fade', duration: 0.3 } },
        sections: [],
      });
      expect(r.success).toBe(true);
    });

    it('rejects removed global.transitionDuration field', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { transitionDuration: 0.5 },
        sections: [],
      });
      expect(r.success).toBe(false);
    });

    it('rejects removed global.audioVolumeLevel field', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audioVolumeLevel: 1 },
        sections: [],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — color_background layers / project_video framingGuide', () => {
    it('accepts color_background section with layers', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'color_background',
        options: { layers: [{ color: '#000000', opacity: 0.5 }] },
      });
      expect(r.success).toBe(true);
    });

    it('accepts project_video section with framingGuide', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'project_video',
        options: { framingGuide: { type: 'silhouette', position: 'center', opacity: 0.35 } },
      });
      expect(r.success).toBe(true);
    });

    it('rejects framingGuide with invalid position', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'project_video',
        options: { framingGuide: { type: 'silhouette', position: 'top' } },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — InputOptionsSchema strictness', () => {
    it('rejects removed field frames in input options', () => {
      const r = InputOptionsSchema.safeParse({ frames: 30 });
      expect(r.success).toBe(false);
    });

    it('rejects removed field frequency in input options', () => {
      const r = InputOptionsSchema.safeParse({ frequency: 10 });
      expect(r.success).toBe(false);
    });

    it('rejects removed field overlay in input options', () => {
      const r = InputOptionsSchema.safeParse({ overlay: true });
      expect(r.success).toBe(false);
    });

    it('accepts valid input options', () => {
      const r = InputOptionsSchema.safeParse({ fps: 25, position: '0:0', loop: true });
      expect(r.success).toBe(true);
    });
  });

  describe('Schema — boundary acceptance', () => {
    it('accepts transition duration exactly 5', () => {
      const r = SectionSchema.safeParse({ name: 's1', type: 'video', transition: { type: 'fade', duration: 5 } });
      expect(r.success).toBe(true);
    });

    it('accepts kenburns intensity exactly 2', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        motion: [{ type: 'kenburns', intensity: 2 }],
      });
      expect(r.success).toBe(true);
    });

    it('accepts musicVolume 0', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audio: { musicVolume: 0 } },
        sections: [],
      });
      expect(r.success).toBe(true);
    });

    it('accepts musicVolume 1', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audio: { musicVolume: 1 } },
        sections: [],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('Schema — DuckingSchema object form', () => {
    it('accepts ducking as an object with threshold and ratio', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audio: { ducking: { threshold: 0.05, ratio: 8 } } },
        sections: [],
      });
      expect(r.success).toBe(true);
    });

    it('rejects ducking ratio above 20', () => {
      const r = TemplateDescriptorSchema.safeParse({
        global: { audio: { ducking: { threshold: 0.05, ratio: 25 } } },
        sections: [],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — cross-variant strictness', () => {
    it('rejects framingGuide inside a plain video section options', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        options: { framingGuide: { type: 'silhouette', position: 'center' } },
      });
      expect(r.success).toBe(false);
    });

    it('rejects layers inside a form section options', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'form',
        options: { layers: [{ color: '#000000' }] },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — audioFade curve validation', () => {
    it('rejects invalid audioFade curve', () => {
      const r = SectionSchema.safeParse({
        name: 's1',
        type: 'video',
        options: { audioFade: { in: { duration: 0.5, curve: 'notacurve' } } },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Schema — JSON Schema export (templateDescriptorJsonSchema)', () => {
    it('is an object with properties.global and properties.sections', () => {
      expect(typeof templateDescriptorJsonSchema).toBe('object');
      expect(templateDescriptorJsonSchema).not.toBeNull();
      const props = (templateDescriptorJsonSchema as Record<string, unknown>).properties as
        | Record<string, unknown>
        | undefined;
      expect(props).toBeDefined();
      expect(props?.global).toBeDefined();
      expect(props?.sections).toBeDefined();
    });

    it('preserves description strings in the JSON Schema output', () => {
      const json = JSON.stringify(templateDescriptorJsonSchema);
      expect(json).toContain('xfade transition name between this section and the next');
    });
  });
});
