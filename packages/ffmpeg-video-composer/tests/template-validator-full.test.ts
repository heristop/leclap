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
          audio: { sourceVolume: 0.5 },
          transition: { type: 'fade', duration: 1 },
          music: { name: 'theme', url: 'http://a/m.mp3' },
        },
        sections: [
          { name: 'main', type: 'project_video' },
          {
            name: 'intro',
            type: 'video',
            options: { useVideoSection: 'main', duration: 5, speed: 1, muteSection: true },
            filters: [{ type: 'scale', value: '2' }],
            inputs: [{ name: 'logo', url: 'http://a/l.png' }],
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
      const sample = (await import('./fixtures/drink-and-code.json')).default;
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
// Cross-section semantic checks: transitions and motion effects.
// ---------------------------------------------------------------------------

describe('TemplateValidator – validateTransitions', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  // ── dangling_transition ──────────────────────────────────────────────────

  it('flags a non-cut transition on the last rendering section', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'intro', type: 'video', transition: { type: 'fade' } },
        { name: 'body', type: 'project_video', transition: { type: 'dissolve' } },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.code === 'dangling_transition')).toBe(true);
    // only the LAST rendering section is flagged, not the middle one
    expect(result.errors?.filter((e) => e.code === 'dangling_transition')).toHaveLength(1);
    expect(result.errors?.find((e) => e.code === 'dangling_transition')?.path).toContain('sections[1]');
  });

  it('does NOT flag a cut transition on the last rendering section', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'intro', type: 'video' },
        { name: 'outro', type: 'color_background', transition: { type: 'cut' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('does NOT flag a non-cut transition on a middle rendering section', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', transition: { type: 'fade' } },
        { name: 'b', type: 'image_background' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('ignores form and music sections when determining the last rendering section', () => {
    // form and music are not rendering sections; the last rendering section is 'outro'
    const result = validator.validateTemplate({
      sections: [
        { name: 'body', type: 'project_video', transition: { type: 'wipeleft' } },
        { name: 'outro', type: 'color_background', transition: { type: 'fade' } },
        { name: 'meta', type: 'form' },
        { name: 'bg', type: 'music' },
      ],
    });
    expect(result.success).toBe(false);
    const dangling = result.errors?.filter((e) => e.code === 'dangling_transition');
    expect(dangling).toHaveLength(1);
    expect(dangling?.[0].path).toContain('sections[1]');
  });

  it('passes a template with no sections', () => {
    expect(validator.validateTemplate({ sections: [] }).success).toBe(true);
  });

  it('passes when the last rendering section has no transition', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', transition: { type: 'fade' } },
        { name: 'b', type: 'project_video' },
      ],
    });
    expect(result.success).toBe(true);
  });

  // ── transition_too_long ───────────────────────────────────────────────────

  it('flags a transition whose effective duration >= the smaller adjacent duration', () => {
    const result = validator.validateTemplate({
      sections: [
        // section A: duration 2s, transition 2s (effective = 2, smaller = min(2,3) = 2 → 2 >= 2 → error)
        { name: 'a', type: 'video', options: { duration: 2 }, transition: { type: 'fade', duration: 2 } },
        { name: 'b', type: 'color_background', options: { duration: 3 } },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.code === 'transition_too_long')).toBe(true);
  });

  it('flags a transition whose effective duration uses the global default and is too long', () => {
    const result = validator.validateTemplate({
      global: { transition: { type: 'dissolve', duration: 1 } },
      sections: [
        // no per-section duration on the transition, falls back to global 1s; smaller of (0.5, 2) = 0.5 → 1 >= 0.5 → error
        { name: 'a', type: 'video', options: { duration: 0.5 }, transition: { type: 'dissolve' } },
        { name: 'b', type: 'image_background', options: { duration: 2 } },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.code === 'transition_too_long')).toBe(true);
  });

  it('does NOT flag a transition that is shorter than both adjacent durations', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', options: { duration: 5 }, transition: { type: 'fade', duration: 1 } },
        { name: 'b', type: 'color_background', options: { duration: 5 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('skips the check when either adjacent section has no explicit duration (project_video runtime probe)', () => {
    // b is project_video with no explicit duration – runtime-probed, skip check
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', options: { duration: 1 }, transition: { type: 'fade', duration: 0.9 } },
        { name: 'b', type: 'project_video' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('skips the check when the transition section itself has no explicit duration', () => {
    const result = validator.validateTemplate({
      sections: [
        // a has no explicit duration, so skip even though transition duration would be > b's duration
        { name: 'a', type: 'video', transition: { type: 'fade', duration: 5 } },
        { name: 'b', type: 'color_background', options: { duration: 1 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('uses the hardcoded 0.3s default when neither section nor global specifies a transition duration', () => {
    // effective duration = 0.3; both sections are 1s each → 0.3 < 1 → no error
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', options: { duration: 1 }, transition: { type: 'fade' } },
        { name: 'b', type: 'color_background', options: { duration: 1 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('flags when effective duration (0.3 default) >= smaller adjacent duration', () => {
    // effective = 0.3, durations are (0.2, 1) → smaller = 0.2 → 0.3 >= 0.2 → error
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', options: { duration: 0.2 }, transition: { type: 'fade' } },
        { name: 'b', type: 'color_background', options: { duration: 1 } },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.code === 'transition_too_long')).toBe(true);
  });
});

describe('TemplateValidator – validateMotion', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  it('allows kenburns motion on a video section', () => {
    const result = validator.validateTemplate({
      sections: [{ name: 'a', type: 'video', motion: [{ type: 'kenburns' }] }],
    });
    expect(result.success).toBe(true);
  });

  it('allows kenburns motion on a project_video section', () => {
    const result = validator.validateTemplate({
      sections: [{ name: 'a', type: 'project_video', motion: [{ type: 'kenburns', direction: 'in' }] }],
    });
    expect(result.success).toBe(true);
  });

  it('flags kenburns motion on a color_background section', () => {
    const result = validator.validateTemplate({
      sections: [{ name: 'a', type: 'color_background', motion: [{ type: 'kenburns' }] }],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.code === 'motion_unsupported_section')).toBe(true);
  });

  it('allows kenburns motion on an image_background section', () => {
    const result = validator.validateTemplate({
      sections: [{ name: 'a', type: 'image_background', motion: [{ type: 'kenburns', intensity: 1.5 }] }],
    });
    expect(result.success).toBe(true);
  });

  it('allows non-kenburns motion effects on any section type', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'video', motion: [{ type: 'flip', axis: 'horizontal' }] },
        { name: 'b', type: 'project_video', motion: [{ type: 'rotate', angle: 90 }] },
        { name: 'c', type: 'color_background', motion: [{ type: 'crop', w: 100, h: 100 }] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('flags each section with kenburns on an unsupported (non-video, non-image) type', () => {
    const result = validator.validateTemplate({
      sections: [
        { name: 'a', type: 'color_background', motion: [{ type: 'kenburns' }] },
        { name: 'b', type: 'image_background', motion: [{ type: 'kenburns' }] },
        { name: 'c', type: 'color_background', motion: [{ type: 'kenburns' }] },
      ],
    });
    expect(result.success).toBe(false);
    const motionErrors = result.errors?.filter((e) => e.code === 'motion_unsupported_section');
    expect(motionErrors).toHaveLength(2); // a and c, not b
  });

  it('passes a section with no motion effects', () => {
    expect(validator.validateTemplate({ sections: [{ name: 'a', type: 'video' }] }).success).toBe(true);
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
    expect(GlobalConfigSchema.safeParse({ audio: { sourceVolume: 0.5 } }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ audio: { sourceVolume: 2 } }).success).toBe(false);
    expect(GlobalConfigSchema.safeParse({ transition: { type: 'fade', duration: 1 } }).success).toBe(true);
    expect(GlobalConfigSchema.safeParse({ transition: { type: 'fade', duration: -1 } }).success).toBe(false);
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
        type: 'animation',
        options: { fps: 25, position: '0:0', scale: '1:1', persistent: true, loop: false },
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
