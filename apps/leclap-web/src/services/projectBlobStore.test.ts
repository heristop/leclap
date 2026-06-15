import { describe, it, expect } from 'vitest';
import { ProjectBlobStore, type BlobBackend, type BlobRecord } from './projectBlobStore';

function fakeBackend(): BlobBackend {
  const map = new Map<string, BlobRecord>();

  return {
    put: async (record) => {
      map.set(record.key, record);
    },
    get: async (key) => map.get(key) ?? null,
    delete: async (key) => {
      map.delete(key);
    },
  };
}

describe('ProjectBlobStore', () => {
  it('stores bytes under a generated key and reads them back', async () => {
    let n = 0;
    const store = new ProjectBlobStore(fakeBackend(), () => `blob-${++n}`);

    const key = await store.put(new Uint8Array([1, 2, 3]));

    expect(key).toBe('blob-1');
    expect(await store.get('blob-1')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('returns null for a missing key and reports has()', async () => {
    const store = new ProjectBlobStore(fakeBackend(), () => 'k');
    expect(await store.get('missing')).toBeNull();
    expect(await store.has('missing')).toBe(false);

    await store.put(new Uint8Array([9]));
    expect(await store.has('k')).toBe(true);
  });

  it('deletes a key', async () => {
    const store = new ProjectBlobStore(fakeBackend(), () => 'k');
    await store.put(new Uint8Array([7]));
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });
});
