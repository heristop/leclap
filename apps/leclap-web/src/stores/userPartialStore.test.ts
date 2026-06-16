import { describe, expect, it } from 'vitest';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { normalizePartialId, UserPartialService } from './userPartialStore';

function memoryStorage(seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

const validPartial: TemplatePartial = {
  id: 'Intro Card',
  description: 'Reusable intro',
  sections: [{ name: 'intro', type: 'color_background', options: { duration: 1, backgroundColor: '#111111' } }],
};

describe('UserPartialService', () => {
  it('saves local partials under a namespaced id', () => {
    const service = new UserPartialService(memoryStorage(), { validatePartial: () => ({ success: true }) }, () => 123);

    const saved = service.save(validPartial);

    expect(saved.id).toBe('local:intro-card');
    expect(saved.source).toBe('local');
    expect(saved.createdAt).toBe(123);
    expect(service.get('Intro Card')?.id).toBe('local:intro-card');
  });

  it('updates an existing partial without resetting createdAt', () => {
    let now = 100;
    const service = new UserPartialService(memoryStorage(), { validatePartial: () => ({ success: true }) }, () => now);

    service.save(validPartial);
    now = 200;
    const updated = service.save({ ...validPartial, description: 'Updated' });

    expect(updated.createdAt).toBe(100);
    expect(updated.updatedAt).toBe(200);
    expect(service.list()).toHaveLength(1);
  });

  it('rejects invalid partial JSON before persisting', () => {
    const service = new UserPartialService(memoryStorage(), {
      validatePartial: () => ({ success: false, errors: [{ message: 'bad section' }] }),
    });

    expect(() => service.save(validPartial)).toThrow(/bad section/);
    expect(service.list()).toHaveLength(0);
  });

  it('normalizes ids deterministically', () => {
    expect(normalizePartialId('local:My Intro!')).toBe('local:my-intro');
    expect(normalizePartialId('   ')).toBe('local:partial');
  });
});
