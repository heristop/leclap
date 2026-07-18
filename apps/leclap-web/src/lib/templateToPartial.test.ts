import { describe, expect, it } from 'vitest';
import type { Template } from '@/services/templateService';
import { templateToPartial } from './templateToPartial';

const make = (over: Partial<Template>): Template => ({
  id: 'x',
  name: '',
  description: '',
  orientation: 'landscape',
  hasForm: false,
  complexity: 'simple',
  source: 'user',
  descriptor: {},
  ...over,
});

describe('templateToPartial', () => {
  it('slugifies the template name into a local: id', () => {
    const partial = templateToPartial(make({ name: 'Present Yourself' }));
    expect(partial.id).toBe('local:present-yourself');
  });

  it('falls back to the name when description is empty', () => {
    const partial = templateToPartial(make({ name: 'Present Yourself', description: '' }));
    expect(partial.description).toBe('Present Yourself');
  });

  it('carries the descriptor sections through', () => {
    const sections = [{ name: 's1', type: 'text' }];
    const partial = templateToPartial(make({ name: 'A', descriptor: { sections } }));
    expect(partial.sections).toEqual(sections);
  });

  it('uses an empty array when the descriptor has no sections', () => {
    const partial = templateToPartial(make({ name: 'A', descriptor: {} }));
    expect(partial.sections).toEqual([]);
  });

  it('carries global string variables when present', () => {
    const partial = templateToPartial(make({ name: 'A', descriptor: { global: { variables: { color: '#fff' } } } }));
    expect(partial.variables).toEqual({ color: '#fff' });
  });

  it('omits variables when global variables hold non-string values', () => {
    const partial = templateToPartial(
      make({ name: 'A', descriptor: { global: { variables: { colors: ['#fff', '#000'] } } } })
    );
    expect(partial.variables).toBeUndefined();
  });
});
