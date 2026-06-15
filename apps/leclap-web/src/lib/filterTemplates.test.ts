import { describe, expect, it } from 'vitest';
import type { Template } from '@/services/templateService';
import { filterTemplates } from './filterTemplates';

const make = (over: Partial<Template>): Template => ({
  id: 'x',
  name: '',
  description: '',
  orientation: 'landscape',
  hasForm: false,
  complexity: 'simple',
  source: 'sample',
  descriptor: {},
  ...over,
});

const all = { query: '', orientation: 'all', complexity: 'all' } as const;

describe('filterTemplates', () => {
  it('returns everything for an empty query and "all" facets', () => {
    const list = [make({ id: 'a' }), make({ id: 'b' })];
    expect(filterTemplates(list, all)).toHaveLength(2);
  });

  it('matches name or description, case-insensitive', () => {
    const list = [make({ name: 'Spotlight' }), make({ description: 'a Flash intro' }), make({ name: 'Quote' })];
    expect(filterTemplates(list, { ...all, query: 'flash' })).toHaveLength(1);
  });

  it('filters by orientation and complexity, AND-combined', () => {
    const list = [
      make({ orientation: 'portrait', complexity: 'simple' }),
      make({ orientation: 'portrait', complexity: 'advanced' }),
      make({ orientation: 'landscape', complexity: 'advanced' }),
    ];
    expect(filterTemplates(list, { ...all, orientation: 'portrait' })).toHaveLength(2);
    expect(filterTemplates(list, { ...all, orientation: 'portrait', complexity: 'advanced' })).toHaveLength(1);
  });
});
