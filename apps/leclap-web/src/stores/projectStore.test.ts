import { describe, it, expect, beforeEach } from 'vitest';
import { UserProjectService } from './projectStore';
import type { StoredProject } from '@/lib/projectModel';

function makeStorage(): Storage {
  const map = new Map<string, string>();

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

const project = (over: Partial<StoredProject> = {}): StoredProject => ({
  id: 'p1',
  name: 'Spotlight',
  templateId: 'tpl-1',
  templateName: 'Spotlight',
  orientation: 'portrait',
  status: 'draft',
  stepIndex: 0,
  formData: {},
  musicChoice: null,
  backgroundChoice: null,
  clips: {},
  edits: {},
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('UserProjectService', () => {
  let storage: Storage;
  let service: UserProjectService;

  beforeEach(() => {
    storage = makeStorage();
    service = new UserProjectService(storage);
  });

  it('returns [] when nothing is stored', () => {
    expect(service.list()).toEqual([]);
  });

  it('saves and reads back a project', () => {
    service.save(project());
    expect(service.list()).toHaveLength(1);
    expect(service.get('p1')?.templateName).toBe('Spotlight');
  });

  it('upserts by id rather than duplicating', () => {
    service.save(project({ stepIndex: 0 }));
    service.save(project({ stepIndex: 3 }));
    expect(service.list()).toHaveLength(1);
    expect(service.get('p1')?.stepIndex).toBe(3);
  });

  it('removes a project', () => {
    service.save(project());
    service.remove('p1');
    expect(service.get('p1')).toBeNull();
  });

  it('survives corrupt storage by returning []', () => {
    storage.setItem('leclap.projects', '{not json');
    expect(service.list()).toEqual([]);
  });

  it('swallows quota errors on save (best-effort)', () => {
    const throwing = makeStorage();
    throwing.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    const svc = new UserProjectService(throwing);
    expect(() => svc.save(project())).not.toThrow();
  });

  it('is a no-op with a null storage backend', () => {
    const svc = new UserProjectService(null);
    expect(svc.list()).toEqual([]);
    expect(() => svc.save(project())).not.toThrow();
    expect(svc.get('p1')).toBeNull();
  });
});
