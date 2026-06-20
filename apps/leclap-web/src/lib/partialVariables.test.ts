import { describe, expect, it } from 'vitest';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { partialVariableNames } from './partialVariables';

type PartialInput = Pick<TemplatePartial, 'sections' | 'variables'>;

describe('partialVariableNames', () => {
  it('collects {{ token }} references from nested section strings in first-seen order', () => {
    const partial: PartialInput = {
      sections: [
        {
          name: 'intro',
          type: 'text',
          options: { content: 'Hello {{ name }}', meta: { logo: '{{ logo }}' } },
        },
      ] as TemplatePartial['sections'],
    };

    expect(partialVariableNames(partial)).toEqual(['name', 'logo']);
  });

  it('merges and dedupes declared variables keys, preserving order', () => {
    const partial: PartialInput = {
      sections: [{ name: 's', type: 'text', options: { content: '{{ name }}' } }] as TemplatePartial['sections'],
      variables: { name: 'Ada', color: '#fff' },
    };

    expect(partialVariableNames(partial)).toEqual(['name', 'color']);
  });

  it('returns an empty array when nothing is referenced or declared', () => {
    expect(partialVariableNames({ sections: [] })).toEqual([]);
  });
});
