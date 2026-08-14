import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import { validateTemplate } from '../src/compose/validation.js';

describe('validateTemplate', () => {
  it('accepts a structurally valid descriptor', () => {
    const result = validateTemplate({ sections: [{ name: 'intro', type: 'video' }] });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.descriptor.sections?.[0].name).toBe('intro');
    }
  });

  it('rejects an invalid descriptor with a capped, dotted-path summary', () => {
    const result = validateTemplate({
      sections: [{ type: 5 }, { name: 7 }, { name: 8 }, { name: 9 }],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).toMatch(/^Invalid template: /);
      // Dotted paths into the offending fields.
      expect(result.message).toContain('sections.0');
      // First three issues only, then a "+N more" suffix.
      expect(result.message).toMatch(/\(\+\d+ more\)/);
      expect(result.message.split(';').length).toBeLessThanOrEqual(3);
    }
  });

  // Regression guard: this module used to run only the bare Zod schema while the engine's compile
  // gate runs the full TemplateValidator, so a schema-valid template with a dangling section
  // reference validated clean here and then failed mid-render inside compose_video.
  it('rejects a schema-valid descriptor whose section reference the engine would refuse', () => {
    const result = validateTemplate({
      sections: [
        { name: 'intro', type: 'video', options: { duration: 3 } },
        { name: 'echo', type: 'video', options: { duration: 3, useVideoSection: 'nope' } },
      ],
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).toContain('nope');
    }
  });

  // Regression guard: `{type:'partial'}` sections are expanded by the engine before rendering, so
  // the descriptor handed to the coverage checks must carry the REAL sections — a project_video
  // living inside a partial used to be invisible to requiredClips/checkSectionCoverage.
  it('returns the partial-expanded descriptor so inner sections are visible', () => {
    const result = validateTemplate({
      partials: [{ id: 'cam', sections: [{ name: 'clip', type: 'project_video', options: { duration: 3 } }] }],
      sections: [{ type: 'partial', ref: 'cam' }],
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.descriptor.sections?.map((section) => section.type)).toEqual(['project_video']);
      expect(result.descriptor.sections?.[0].name).toBe('clip');
    }
  });
});
