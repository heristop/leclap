import { describe, test, expect, beforeEach } from 'vitest';
import { TemplateValidator } from '../services/TemplateValidator';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Template Validation', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  const loadTemplate = (filename: string) => {
    const templatePath = join(__dirname, '../shared/templates', filename);
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

    test('should validate fast_and_curious.json template', () => {
      const template = loadTemplate('fast_and_curious.json');
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
      if (result.data) {
        const warnings = validator.getVariableWarnings(result.data);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.some((err) => err.code === 'undefined_variable')).toBe(true);
        expect(warnings.some((err) => err.message.includes('undefinedVar'))).toBe(true);
      }
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
      expect(result.errors!.some((err) => err.code === 'undefined_section_reference')).toBe(true);
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
      expect(result.errors![0].code).toBe('json_parse_error');
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

      expect(summary).toBe('Template validation passed successfully');
    });

    test('should provide error summary', () => {
      const template = { sections: [{ name: 'test', type: 'invalid' }] };
      const result = validator.validateTemplate(template);
      const summary = validator.getValidationSummary(result);

      expect(summary).toContain('Template validation failed');
      expect(summary).toContain('error');
    });
  });
});
