import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateValidator, type ValidationResult } from '@/services/TemplateValidator';
import {
  TemplateDescriptorSchema,
  SectionSchema,
  GlobalConfigSchema,
  FilterSchema,
  MapSchema,
  InputSchema,
  FieldSchema,
  VariablesSchema,
  MusicConfigSchema,
} from '@/schemas/template.schemas';
import { ZodError } from 'zod';

describe('TemplateValidator (gap coverage)', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
    vi.restoreAllMocks();
  });

  describe('validateTemplate - success and section references', () => {
    it('accepts an empty template', () => {
      const result = validator.validateTemplate({ sections: [] });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('accepts a fully featured template', () => {
      const template = {
        global: {
          variables: { a: '1', list: ['x', 'y'] },
          orientation: 'landscape',
          colorsList: ['#fff'],
          musicEnabled: true,
          audioVolumeLevel: 0.5,
          transitionDuration: 1,
          music: { name: 'theme', url: 'http://a/m.mp3' },
        },
        sections: [
          { name: 'main', type: 'project_video' },
          {
            name: 'intro',
            type: 'video',
            options: { useVideoSection: 'main', duration: 5, speed: 1, muteSection: true },
            filters: [{ type: 'scale', value: '2' }],
            inputs: [{ name: 'logo', url: 'http://a/l.png', type: 'image' }],
            maps: [{ inputs: ['0:v'], outputs: ['o'], filters: [{ type: 'eq', value: '1' }] }],
            title: { en: 'Intro' },
            description: { en: 'desc' },
          },
        ],
      };
      const result = validator.validateTemplate(template);
      expect(result.success).toBe(true);
    });

    it('flags an undefined section reference as a hard error', () => {
      const result = validator.validateTemplate({
        sections: [{ name: 'intro', type: 'video', options: { useVideoSection: 'ghost' } }],
      });
      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('undefined_section_reference');
      // template data is still returned alongside section-ref errors
      expect(result.data).toBeDefined();
    });
  });

  describe('validateTemplate - zod failure path', () => {
    it('formats zod issues for an invalid section type', () => {
      const result = validator.validateTemplate({ sections: [{ name: 'x', type: 'nope' }] });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(typeof result.errors?.[0].path).toBe('string');
    });

    it('reports a non-object template via zod failure', () => {
      const result = validator.validateTemplate(42);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateTemplate - custom validation catch path', () => {
    it('wraps an error thrown inside section-reference validation', () => {
      // Force validateSectionReferences to throw to hit the custom_validation_error branch.
      const spy = vi
        .spyOn(validator as unknown as { validateSectionReferences: () => void }, 'validateSectionReferences')
        .mockImplementation(() => {
          throw new Error('boom in section refs');
        });
      const result = validator.validateTemplate({ sections: [] });
      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('custom_validation_error');
      expect(result.errors?.[0].message).toBe('boom in section refs');
      spy.mockRestore();
    });

    it('uses a generic message when a non-Error is thrown in custom validation', () => {
      const spy = vi
        .spyOn(validator as unknown as { validateSectionReferences: () => void }, 'validateSectionReferences')
        .mockImplementation(() => {
          throw 'string failure';
        });
      const result = validator.validateTemplate({ sections: [] });
      expect(result.success).toBe(false);
      expect(result.errors?.[0].message).toBe('Error in custom validation');
      spy.mockRestore();
    });
  });

  describe('validateTemplate - safeParse throw path', () => {
    it('handles a thrown error from schema parsing', () => {
      const spy = vi.spyOn(TemplateDescriptorSchema, 'safeParse').mockImplementation(() => {
        throw new Error('parser exploded');
      });
      const result = validator.validateTemplate({});
      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('zod_error');
      expect(result.errors?.[0].message).toBe('parser exploded');
      spy.mockRestore();
    });

    it('handles a thrown non-Error from schema parsing', () => {
      const spy = vi.spyOn(TemplateDescriptorSchema, 'safeParse').mockImplementation(() => {
        throw 'not-an-error';
      });
      const result = validator.validateTemplate({});
      expect(result.success).toBe(false);
      expect(result.errors?.[0].message).toBe('Zod parsing error');
      spy.mockRestore();
    });
  });

  describe('validateSection', () => {
    it('validates a correct video section', () => {
      const result = validator.validateSection({ name: 's', type: 'video', options: { duration: 3 } });
      expect(result.success).toBe(true);
    });

    it('returns formatted errors for an invalid section', () => {
      const result = validator.validateSection({ name: 's', type: 'unknown' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('wraps a thrown error from section parsing', () => {
      const spy = vi.spyOn(SectionSchema, 'safeParse').mockImplementation(() => {
        throw new Error('section parser failed');
      });
      const result = validator.validateSection({});
      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('validation_error');
      expect(result.errors?.[0].message).toBe('section parser failed');
      spy.mockRestore();
    });

    it('uses a generic message for a thrown non-Error in section parsing', () => {
      const spy = vi.spyOn(SectionSchema, 'safeParse').mockImplementation(() => {
        throw 99;
      });
      const result = validator.validateSection({});
      expect(result.success).toBe(false);
      expect(result.errors?.[0].message).toBe('Unknown validation error');
      spy.mockRestore();
    });
  });

  describe('validateTemplateFromJSON', () => {
    it('parses and validates valid JSON', () => {
      const result = validator.validateTemplateFromJSON(JSON.stringify({ sections: [] }));
      expect(result.success).toBe(true);
    });

    it('reports a json_parse_error for malformed JSON', () => {
      const result = validator.validateTemplateFromJSON('{ bad json ');
      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('json_parse_error');
    });
  });

  describe('validateTemplateFromFile', () => {
    it('refuses file operations in a browser environment', async () => {
      const prev = process.env.PLATFORM;
      process.env.PLATFORM = 'browser';
      try {
        const result = await validator.validateTemplateFromFile('/whatever.json');
        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('unsupported_environment');
      } finally {
        process.env.PLATFORM = prev;
      }
    });

    it('validates a real shipped template (loaded via the @ alias)', async () => {
      const sample = (await import('@/shared/templates/sample.json')).default;
      const result = validator.validateTemplate(sample);
      expect(result.success).toBe(true);
    });

    it('reports a file_error when the file cannot be read', async () => {
      const prev = process.env.PLATFORM;
      delete process.env.PLATFORM;
      try {
        const result = await validator.validateTemplateFromFile('/no/such/file.json');
        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('file_error');
      } finally {
        if (prev !== undefined) process.env.PLATFORM = prev;
      }
    });
  });

  describe('getVariableWarnings', () => {
    it('returns no warnings when there are no variables', () => {
      expect(validator.getVariableWarnings({})).toEqual([]);
    });

    it('detects undefined variable references nested in arrays and objects', () => {
      const warnings = validator.getVariableWarnings({
        global: { variables: { defined: '1' } },
        sections: [
          {
            name: 's',
            type: 'video',
            filters: [{ type: 'drawtext', values: { text: { en: '{{ missingVar }} and {{ defined }}' } } }],
          },
        ],
      } as never);
      expect(warnings.some((w) => w.code === 'undefined_variable')).toBe(true);
      expect(warnings.some((w) => w.message.includes('missingVar'))).toBe(true);
      // exactly one undefined-variable warning: the defined variable is not reported
      expect(warnings.filter((w) => w.code === 'undefined_variable')).toHaveLength(1);
      expect(warnings.some((w) => w.message.endsWith('myKnownVar'))).toBe(false);
    });

    it('reports no warnings when all references are defined', () => {
      const warnings = validator.getVariableWarnings({
        global: { variables: { name: 'x' } },
        sections: [{ name: 's', type: 'video', title: { en: '{{ name }}' } }],
      } as never);
      expect(warnings).toEqual([]);
    });
  });

  describe('getValidationSummary', () => {
    it('summarizes a successful result', () => {
      expect(validator.getValidationSummary({ success: true })).toBe('Template validation passed');
    });

    it('summarizes a failed result with a count and truncation marker', () => {
      const result: ValidationResult = {
        success: false,
        errors: [
          { path: 'a', message: 'e1', code: 'c' },
          { path: 'b', message: 'e2', code: 'c' },
          { path: 'c', message: 'e3', code: 'c' },
          { path: 'd', message: 'e4', code: 'c' },
        ],
      };
      const summary = validator.getValidationSummary(result);
      expect(summary).toContain('failed with 4 error(s)');
      expect(summary).toContain('...');
      expect(summary).toContain('a: e1');
    });

    it('handles a failed result with no error array', () => {
      const summary = validator.getValidationSummary({ success: false });
      expect(summary).toContain('failed with 0 error(s)');
    });
  });

  describe('formatZodError (private branch coverage)', () => {
    const fmt = (err: unknown): { code: string; path: string; message: string }[] =>
      (
        validator as unknown as { formatZodError: (e: unknown) => { code: string; path: string; message: string }[] }
      ).formatZodError(err);

    it('returns invalid_zod_error when there are no issues and no message', () => {
      const fake = { issues: undefined, message: '' };
      const result = fmt(fake);
      expect(result[0].code).toBe('invalid_zod_error');
    });

    it('parses a JSON-encoded message into issues', () => {
      const fake = {
        issues: undefined,
        message: JSON.stringify([{ path: ['sections', 0], message: 'bad', code: 'custom' }]),
      };
      const result = fmt(fake);
      expect(result[0].path).toBe('sections.0');
      expect(result[0].message).toBe('bad');
      expect(result[0].code).toBe('custom');
    });

    it('falls back to a single error when the message is not JSON', () => {
      const fake = { issues: undefined, message: 'plain text failure' };
      const result = fmt(fake);
      expect(result[0].message).toBe('plain text failure');
      expect(result[0].code).toBe('zod_error');
      // the synthetic error uses an empty path array which joins to ''
      expect(result[0].path).toBe('');
    });

    it('defaults path/message/code for malformed issue entries', () => {
      const fake = { issues: [{}], message: '' };
      const result = fmt(fake);
      expect(result[0].path).toBe('unknown');
      expect(result[0].message).toBe('Unknown validation error');
      expect(result[0].code).toBe('unknown');
    });

    it('joins array paths from real zod issues', () => {
      const parsed = SectionSchema.safeParse({ name: 's', type: 'video', options: { duration: -1 } });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const result = fmt(parsed.error);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].path).toContain('options');
      }
    });

    it('recovers when mapping throws by returning a format_error', () => {
      // issues is a non-array truthy value -> hasIssues false, message empty ->
      // we instead force the inner mapping to throw by making issues a getter that throws.
      const evil: Record<string, unknown> = { message: 'm' };
      Object.defineProperty(evil, 'issues', {
        get() {
          throw new Error('issues access failed');
        },
      });
      const result = fmt(evil);
      expect(result[0].code).toBe('format_error');
      expect(result[0].message).toContain('issues access failed');
    });

    it('handles a genuine ZodError instance', () => {
      const zerr = new ZodError([
        { code: 'custom', path: ['root'], message: 'manual' } as unknown as ZodError['issues'][number],
      ]);
      const result = fmt(zerr);
      expect(result[0].message).toBe('manual');
      expect(result[0].path).toBe('root');
    });
  });
});

// ---------------------------------------------------------------------------
// Schema-level coverage: exercise each schema's accept/reject paths directly.
// ---------------------------------------------------------------------------

describe('template.schemas', () => {
  it('MusicConfigSchema requires a name and allows optional url', () => {
    expect(MusicConfigSchema.safeParse({ name: 'm' }).success).toBe(true);
    expect(MusicConfigSchema.safeParse({ name: 'm', url: 'http://x' }).success).toBe(true);
    expect(MusicConfigSchema.safeParse({}).success).toBe(false);
  });

  it('VariablesSchema accepts strings and string arrays', () => {
    expect(VariablesSchema.safeParse({ a: 'x', b: ['y', 'z'] }).success).toBe(true);
    expect(VariablesSchema.safeParse({ a: 1 }).success).toBe(false);
  });

  it('GlobalConfigSchema enforces ranges and enums', () => {
    expect(GlobalConfigSchema.safeParse({ orientation: 'landscape' }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ orientation: 'diagonal' }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ audioVolumeLevel: 0.5 }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ audioVolumeLevel: 2 }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ transitionDuration: 1 }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ transitionDuration: -1 }).success).toBe(false);
  });

  it('FilterSchema accepts value or values', () => {
    expect(FilterSchema.safeParse({ type: 'scale', value: '2' }).success).toBe(true);
    expect(FilterSchema.safeParse({ type: 'scale', value: 2 }).success).toBe(true);
    expect(FilterSchema.safeParse({ type: 'drawtext', values: { fontsize: 12 } }).success).toBe(true);
    expect(FilterSchema.safeParse({ value: 'x' }).success).toBe(false); // missing type
  });

  it('MapSchema requires inputs and outputs arrays', () => {
    expect(MapSchema.safeParse({ inputs: ['0:v'], outputs: ['o'] }).success).toBe(true);
    expect(MapSchema.safeParse({ inputs: ['0:v'] }).success).toBe(false);
  });

  it('InputSchema requires a name and allows nested options/filters', () => {
    expect(
      InputSchema.safeParse({
        name: 'a',
        url: 'http://x',
        type: 'frame',
        options: { frames: 3, frequency: 1, overlay: '0:0', scale: '1:1', persistent: true },
        filters: [{ type: 'scale', value: '2' }],
      }).success
    ).toBe(true);
    expect(InputSchema.safeParse({ url: 'http://x' }).success).toBe(false);
  });

  it('FieldSchema requires a positive maxLength and a label record', () => {
    expect(FieldSchema.safeParse({ name: 'f', maxLength: 10, label: { en: 'F' } }).success).toBe(true);
    expect(FieldSchema.safeParse({ name: 'f', maxLength: -1, label: { en: 'F' } }).success).toBe(false);
    expect(FieldSchema.safeParse({ name: 'f', maxLength: 10 }).success).toBe(false);
  });

  it('SectionSchema discriminates each supported section type', () => {
    const types = ['video', 'project_video', 'form', 'color_background', 'image_background', 'music'];
    for (const type of types) {
      expect(SectionSchema.safeParse({ name: 's', type }).success).toBe(true);
    }
  });

  it('SectionSchema rejects an unknown discriminator', () => {
    expect(SectionSchema.safeParse({ name: 's', type: 'unknown' }).success).toBe(false);
  });

  it('form section accepts a fields array', () => {
    const result = SectionSchema.safeParse({
      name: 'f',
      type: 'form',
      options: { fields: [{ name: 'x', maxLength: 5, label: { en: 'X' } }] },
    });
    expect(result.success).toBe(true);
  });

  it('color_background and image_background carry their specific options', () => {
    expect(
      SectionSchema.safeParse({ name: 'c', type: 'color_background', options: { backgroundColor: '#fff' } }).success
    ).toBe(true);
    expect(
      SectionSchema.safeParse({ name: 'i', type: 'image_background', options: { pictureUrl: 'http://x' } }).success
    ).toBe(true);
  });

  it('TemplateDescriptorSchema accepts an empty object and nested sections', () => {
    expect(TemplateDescriptorSchema.safeParse({}).success).toBe(true);
    expect(TemplateDescriptorSchema.safeParse({ global: { orientation: 'portrait' }, sections: [] }).success).toBe(
      true
    );
  });
});
