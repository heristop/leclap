import { describe, expect, it } from 'vitest';
import type { StoredTemplate } from '@/stores/userTemplateStore';
import { recentFirst } from './template-library.logic';

const stored = (id: string, updatedAt: number): StoredTemplate =>
  ({ id, name: id, updatedAt, createdAt: 0, source: 'user' }) as StoredTemplate;

describe('recentFirst', () => {
  it('leads with the template saved most recently', () => {
    const list = [stored('old', 10), stored('fresh', 30), stored('mid', 20)];

    expect(recentFirst(list).map((t) => t.id)).toEqual(['fresh', 'mid', 'old']);
  });

  it('leaves the stored list untouched', () => {
    const list = [stored('a', 1), stored('b', 2)];
    recentFirst(list);

    expect(list.map((t) => t.id)).toEqual(['a', 'b']);
  });
});
