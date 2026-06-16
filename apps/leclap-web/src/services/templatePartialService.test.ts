import { describe, expect, it } from 'vitest';
import type { StoredPartial } from '@/stores/userPartialStore';
import { listAvailablePartials, materializeTemplatePartials } from './templatePartialService';

const localPartial: StoredPartial = {
  id: 'local:intro',
  description: 'Local intro',
  source: 'local',
  createdAt: 1,
  updatedAt: 1,
  sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '{{ color }}' } }],
};

describe('templatePartialService', () => {
  it('merges built-in and local partials for selection', () => {
    const partials = listAvailablePartials([localPartial]);

    expect(partials.some((partial) => partial.id === 'logo-bumper' && partial.readonly)).toBe(true);
    expect(partials.find((partial) => partial.id === 'local:intro')).toMatchObject({
      source: 'local',
      readonly: false,
    });
  });

  it('materializes local partial refs before validation or compile', () => {
    const descriptor = materializeTemplatePartials(
      { sections: [{ type: 'partial', ref: 'local:intro', prefix: 'p_', variables: { color: '#ffffff' } }] },
      [localPartial]
    );

    expect(descriptor.sections?.[0]).toMatchObject({
      name: 'p_intro',
      type: 'color_background',
      options: { backgroundColor: '#ffffff' },
    });
  });
});
