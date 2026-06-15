import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { APP_TEMPLATES, APP_TEMPLATES_BY_ID } from '../src/index';
import { expandPartials, expandPartialsWithRegistry, type TemplatePartial } from '../src/partials';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, '../src/templates');
const sourceTemplateIds = fs
  .readdirSync(templateDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

describe('@leclap/creative-kit catalog', () => {
  it('discovers every template descriptor JSON', () => {
    expect(APP_TEMPLATES.map((template) => template.id).sort()).toEqual(sourceTemplateIds);
  });

  it('keeps display metadata on each discovered template', () => {
    for (const template of APP_TEMPLATES) {
      expect(template.name, `${template.id} name`).not.toEqual('');
      expect(template.description, `${template.id} description`).not.toEqual('');
      expect(['landscape', 'portrait']).toContain(template.orientation);
      expect(['simple', 'intermediate', 'advanced']).toContain(template.complexity);
    }
  });

  it('expands shared partial refs', () => {
    const descriptor = APP_TEMPLATES_BY_ID['fast-curious']?.descriptor;

    expect(descriptor?.sections?.[0]?.type).toBe('partial');
    expect(expandPartials(descriptor!).sections?.[0]?.name).toBe('logo_bumper');
  });

  it('expands app-provided partial registries without editing the built-in catalog', () => {
    const localPartial: TemplatePartial = {
      id: 'local:intro',
      description: 'Local browser partial',
      sections: [{ name: 'title', type: 'color_background', options: { duration: 1, backgroundColor: '{{ color }}' } }],
    };

    const expanded = expandPartialsWithRegistry(
      { sections: [{ type: 'partial', ref: 'local:intro', prefix: 'p_', variables: { color: '#ffffff' } }] },
      [localPartial]
    );

    expect(expanded.sections?.[0]).toMatchObject({
      name: 'p_title',
      type: 'color_background',
      options: { backgroundColor: '#ffffff' },
    });
  });

  it("applies a partial's default variables, overridable per ref", () => {
    const partial: TemplatePartial = {
      id: 'local:card',
      description: 'card',
      variables: { color: '#ff2e4d', label: 'HELLO' },
      sections: [
        {
          name: 'card',
          type: 'color_background',
          options: { duration: 1, backgroundColor: '{{ color }}' },
          filters: [{ type: 'drawtext', values: { text: { en: '{{ label }}' } } }],
        },
      ],
    };

    const expanded = expandPartialsWithRegistry(
      { sections: [{ type: 'partial', ref: 'local:card', variables: { label: 'BYE' } }] },
      [partial]
    );
    const section = expanded.sections?.[0] as {
      options?: { backgroundColor?: string };
      filters?: Array<{ values?: { text?: { en?: string } } }>;
    };

    // `color` falls back to the partial default; `label` is overridden by the ref.
    expect(section.options?.backgroundColor).toBe('#ff2e4d');
    expect(section.filters?.[0]?.values?.text?.en).toBe('BYE');
  });
});
