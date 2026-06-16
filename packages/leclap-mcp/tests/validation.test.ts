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
});
