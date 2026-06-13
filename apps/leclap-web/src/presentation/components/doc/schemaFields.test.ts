import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { typeLabel, constraintsLabel, fieldRows, fieldGroups, type JsonSchemaNode } from './schemaFields';
import { examples } from './examples';

describe('typeLabel', () => {
  it('names arrays by their item type', () => {
    expect(typeLabel({ type: 'array', items: { type: 'string' } })).toBe('string[]');
  });

  it('collapses an anyOf union and surfaces a const', () => {
    const node: JsonSchemaNode = { anyOf: [{ type: 'string', enum: ['fade'] }, { const: 'cut' }] };
    expect(typeLabel(node)).toBe('string | "cut"');
  });
});

describe('constraintsLabel', () => {
  it('formats a numeric range and default', () => {
    expect(constraintsLabel({ type: 'number', minimum: 0, maximum: 1, default: 0.5 })).toBe('0…1 · default 0.5');
  });

  it('truncates long enums', () => {
    const node: JsonSchemaNode = { enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    expect(constraintsLabel(node)).toContain('…');
  });
});

describe('fieldRows', () => {
  it('marks required properties and carries descriptions', () => {
    const node: JsonSchemaNode = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'the name' },
        opt: { type: 'number' },
      },
    };
    const rows = fieldRows(node);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'name', required: true, description: 'the name' });
    expect(rows[1].required).toBe(false);
  });
});

describe('fieldGroups', () => {
  it('produces non-empty, schema-driven groups for the documented sections', () => {
    const groups = fieldGroups();
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));

    for (const id of ['global', 'section', 'options', 'transition', 'grade', 'audio', 'framing-guide', 'inputs']) {
      expect(byId[id], `group ${id}`).toBeDefined();
      expect(byId[id].rows.length, `group ${id} rows`).toBeGreaterThan(0);
    }
  });

  it('unions options across section types (layers + framingGuide both surface)', () => {
    const options = fieldGroups().find((g) => g.id === 'options');
    const names = options?.rows.map((r) => r.name) ?? [];
    expect(names).toContain('layers');
    expect(names).toContain('framingGuide');
  });
});

describe('example descriptors', () => {
  it('every documented example validates against the descriptor schema', () => {
    for (const example of examples) {
      const parsed = TemplateDescriptorSchema.safeParse(JSON.parse(example.json));
      expect(parsed.success, `${example.id}: ${parsed.error?.message}`).toBe(true);
    }
  });
});
