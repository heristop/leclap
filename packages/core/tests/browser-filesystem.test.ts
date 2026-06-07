import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BrowserFilesystemAdapter from '@/platform/filesystem/BrowserFilesystemAdapter';

/**
 * Minimal in-memory IndexedDB stub good enough for BrowserFilesystemAdapter.
 * It models a single object store keyed by `name`, fires onsuccess/onerror
 * asynchronously, and lets tests force open/operation failures.
 */
interface FakeRequest<T> {
  onsuccess: ((this: unknown, ev: unknown) => void) | null;
  onerror: ((this: unknown, ev: unknown) => void) | null;
  onupgradeneeded?: ((this: unknown, ev: unknown) => void) | null;
  result: T;
  error: { message: string } | null;
}

function makeRequest<T>(): FakeRequest<T> {
  return { onsuccess: null, onerror: null, result: undefined as T, error: null };
}

let store: Map<string, unknown>;
let failOps: boolean;
let failOpen: boolean;

class FakeObjectStore {
  createIndex = vi.fn();

  get(key: string) {
    const req = makeRequest<unknown>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      req.result = store.get(key);
      req.onsuccess?.(null);
    });
    return req;
  }

  put(value: { name: string }) {
    const req = makeRequest<string>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      store.set(value.name, value);
      req.result = value.name;
      req.onsuccess?.(null);
    });
    return req;
  }

  count(key: string) {
    const req = makeRequest<number>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      req.result = store.has(key) ? 1 : 0;
      req.onsuccess?.(null);
    });
    return req;
  }

  delete(key: string) {
    const req = makeRequest<undefined>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      store.delete(key);
      req.onsuccess?.(null);
    });
    return req;
  }

  getAllKeys() {
    const req = makeRequest<string[]>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      req.result = [...store.keys()];
      req.onsuccess?.(null);
    });
    return req;
  }

  clear() {
    const req = makeRequest<undefined>();
    queueMicrotask(() => {
      if (failOps) {
        req.error = { message: 'op failed' };
        req.onerror?.(null);
        return;
      }
      store.clear();
      req.onsuccess?.(null);
    });
    return req;
  }
}

class FakeTransaction {
  private readonly store = new FakeObjectStore();
  objectStore() {
    return this.store;
  }
}

class FakeDB {
  objectStoreNames = {
    _names: new Set<string>(),
    contains(name: string) {
      return this._names.has(name);
    },
  };

  createObjectStore(name: string) {
    this.objectStoreNames._names.add(name);
    return new FakeObjectStore();
  }

  transaction() {
    return new FakeTransaction();
  }
}

function installFakeIndexedDB() {
  const fakeIndexedDB = {
    open() {
      const req = makeRequest<FakeDB>() as FakeRequest<FakeDB> & {
        onupgradeneeded: ((ev: unknown) => void) | null;
      };
      req.onupgradeneeded = null;
      queueMicrotask(() => {
        if (failOpen) {
          req.error = { message: 'open failed' };
          req.onerror?.(null);
          return;
        }
        const db = new FakeDB();
        req.result = db;
        // First-open: trigger the schema upgrade hook.
        req.onupgradeneeded?.({ target: { result: db } });
        req.onsuccess?.(null);
      });
      return req;
    },
  };
  // vi.stubGlobal handles read-only globals (navigator/indexedDB) safely.
  vi.stubGlobal('indexedDB', fakeIndexedDB);
}

describe('BrowserFilesystemAdapter', () => {
  beforeEach(() => {
    store = new Map();
    failOps = false;
    failOpen = false;
    installFakeIndexedDB();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes the DB and runs the upgrade hook on first open', async () => {
      const adapter = new BrowserFilesystemAdapter();
      // exists() forces ensureInitialized() to await the init promise.
      expect(await adapter.exists('nope')).toBe(false);
    });

    it('rejects writes when IndexedDB fails to open', async () => {
      failOpen = true;
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.writeFile('/a', new Uint8Array([1]))).rejects.toThrow(/Failed to open IndexedDB/);
    });
  });

  describe('writeFile / readFile / read / write', () => {
    it('writes and reads back raw bytes', async () => {
      const adapter = new BrowserFilesystemAdapter();
      const data = new Uint8Array([10, 20, 30]);
      await adapter.writeFile('/video.mp4', data);
      expect(await adapter.readFile('/video.mp4')).toEqual(data);
    });

    it('readFile throws when the file is missing', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.readFile('/ghost')).rejects.toThrow('File not found: /ghost');
    });

    it('read decodes stored bytes to text', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.write('/note.txt', 'hello world');
      expect(await adapter.read('/note.txt')).toBe('hello world');
    });

    it('write() without content creates an empty file when absent', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.write('/empty.txt');
      expect(await adapter.exists('/empty.txt')).toBe(true);
      expect(await adapter.readFile('/empty.txt')).toEqual(new Uint8Array(0));
    });

    it('write() without content is a no-op when the file already exists', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.write('/keep.txt', 'original');
      await adapter.write('/keep.txt'); // should not overwrite
      expect(await adapter.read('/keep.txt')).toBe('original');
    });

    it('surfaces a write error from the underlying store', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.exists('warmup'); // ensure DB initialized before flipping the flag
      failOps = true;
      await expect(adapter.writeFile('/x', new Uint8Array([1]))).rejects.toThrow(/Failed to write file \/x/);
    });

    it('derives metadata type from the file extension (getFileType branches)', async () => {
      const adapter = new BrowserFilesystemAdapter();
      const cases: Array<[string, string]> = [
        ['/a.mp4', 'video'],
        ['/a.avi', 'video'],
        ['/a.mov', 'video'],
        ['/a.mkv', 'video'],
        ['/a.mp3', 'audio'],
        ['/a.wav', 'audio'],
        ['/a.aac', 'audio'],
        ['/a.jpg', 'image'],
        ['/a.jpeg', 'image'],
        ['/a.png', 'image'],
        ['/a.gif', 'image'],
        ['/a.json', 'application/json'],
        ['/a.txt', 'text/plain'],
        ['/a.bin', 'application/octet-stream'],
        ['/noextension', 'application/octet-stream'],
      ];
      for (const [path, expectedType] of cases) {
        await adapter.writeFile(path, new Uint8Array([1]));
        const meta = await adapter.getFileMetadata(path);
        expect(meta?.type).toBe(expectedType);
      }
    });
  });

  describe('exists / stat', () => {
    it('reports existence correctly', async () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.exists('/a')).toBe(false);
      await adapter.writeFile('/a', new Uint8Array([1]));
      expect(await adapter.exists('/a')).toBe(true);
      expect(await adapter.stat('/a')).toBe(true);
    });

    it('exists returns false when the count operation fails', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.exists('warmup');
      failOps = true;
      expect(await adapter.exists('/a')).toBe(false);
    });
  });

  describe('copy / move / remove / unlink', () => {
    it('copies bytes to a new path', async () => {
      const adapter = new BrowserFilesystemAdapter();
      const data = new Uint8Array([1, 2]);
      await adapter.writeFile('/src', data);
      await adapter.copy('/src', '/dst');
      expect(await adapter.readFile('/dst')).toEqual(data);
    });

    it('move copies then removes the source', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.writeFile('/src', new Uint8Array([7]));
      await adapter.move('/src', '/dst');
      expect(await adapter.exists('/dst')).toBe(true);
      expect(await adapter.exists('/src')).toBe(false);
    });

    it('remove deletes a file', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.writeFile('/gone', new Uint8Array([1]));
      await adapter.remove('/gone');
      expect(await adapter.exists('/gone')).toBe(false);
    });

    it('unlink delegates to remove', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.writeFile('/gone', new Uint8Array([1]));
      await adapter.unlink('/gone');
      expect(await adapter.exists('/gone')).toBe(false);
    });
  });

  describe('append', () => {
    it('appends bytes to an existing file', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.write('/log.txt', 'ab');
      await adapter.append('/log.txt', 'cd');
      expect(await adapter.read('/log.txt')).toBe('abcd');
    });

    it('throws when appending to a missing file', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.append('/missing.txt', 'x')).rejects.toThrow(/Failed to append content to \/missing.txt/);
    });
  });

  describe('storeFile / getFileMetadata / listFiles / clear', () => {
    const makeFile = (name: string, bytes: number[]): File => {
      const data = new Uint8Array(bytes);
      return {
        name,
        size: data.length,
        type: 'video/mp4',
        lastModified: 12345,
        arrayBuffer: async () => data.buffer,
      } as unknown as File;
    };

    it('stores a File and reads its metadata back', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.storeFile(makeFile('clip.mp4', [1, 2, 3]), '/clip.mp4');
      const meta = await adapter.getFileMetadata('/clip.mp4');
      expect(meta).toMatchObject({ size: 3, type: 'video/mp4', lastModified: 12345 });
    });

    it('getFileMetadata returns null for a missing file', async () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getFileMetadata('/none')).toBeNull();
    });

    it('lists stored file keys', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.writeFile('/a', new Uint8Array([1]));
      await adapter.writeFile('/b', new Uint8Array([2]));
      expect((await adapter.listFiles()).sort()).toEqual(['/a', '/b']);
    });

    it('clears all stored files', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await adapter.writeFile('/a', new Uint8Array([1]));
      await adapter.clear();
      expect(await adapter.listFiles()).toEqual([]);
    });
  });

  describe('ensureDir', () => {
    it('is a virtual no-op', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.ensureDir('/some/dir')).resolves.toBeUndefined();
    });
  });

  describe('path helpers (abstract impls)', () => {
    it('getAssetsPath builds a /assets path', async () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getAssetsPath('videos')).toBe('/assets/videos');
    });

    it('getBuildPath uses the configured build dir when set', async () => {
      const adapter = new BrowserFilesystemAdapter();
      adapter.setBuildDir('/mybuild');
      expect(await adapter.getBuildPath('out')).toBe('/mybuild/out');
    });

    it('getBuildPath falls back to /tmp/build when unset', async () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getBuildPath('out')).toBe('/tmp/build/out');
    });

    it('getSource honors an explicit segment name', () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(adapter.getSource('intro')).toBe('/tmp/intro');
    });

    it('getSource uses the stored segment when no name is given', () => {
      const adapter = new BrowserFilesystemAdapter();
      adapter.setSegment('stored');
      expect(adapter.getSource()).toBe('/tmp/stored');
    });

    it('getSource falls back to /tmp/default with no segment at all', () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(adapter.getSource()).toBe('/tmp/default');
    });

    it('getDestination uses the segment name under the build dir', () => {
      const adapter = new BrowserFilesystemAdapter();
      adapter.setSegment('clip');
      // Full build-dir path so it matches the concat list entries.
      expect(adapter.getDestination()).toBe('/tmp/build/clip_output.mp4');
    });

    it('getDestination falls back to output.mp4 under the build dir', () => {
      const adapter = new BrowserFilesystemAdapter();
      expect(adapter.getDestination()).toBe('/tmp/build/output.mp4');
    });
  });

  describe('fetch / fetchAndRead', () => {
    it('downloads to a file path on a successful fetch', async () => {
      vi.stubGlobal('window', {
        fetch: vi
          .fn()
          .mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('body-text').buffer }),
      });
      const adapter = new BrowserFilesystemAdapter();
      const downloadPath = await adapter.fetch('http://x/y');
      // fetch() now stores the bytes and returns the path (Node-compatible).
      expect(downloadPath).toBe('/tmp/fetch/y');
      expect(await adapter.read(downloadPath)).toBe('body-text');
    });

    it('fetchAndRead returns the downloaded content as text', async () => {
      vi.stubGlobal('window', {
        fetch: vi
          .fn()
          .mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('read-body').buffer }),
      });
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.fetchAndRead('http://x/y')).toBe('read-body');
    });

    it('throws a wrapped error on a non-ok response', async () => {
      vi.stubGlobal('window', {
        fetch: vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
      });
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.fetch('http://x/missing')).rejects.toThrow(
        /Failed to fetch http:\/\/x\/missing: HTTP 404: Not Found/
      );
    });

    it('wraps a thrown network error', async () => {
      vi.stubGlobal('window', {
        fetch: vi.fn().mockRejectedValue(new Error('connection refused')),
      });
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.fetch('http://x/y')).rejects.toThrow(/Failed to fetch http:\/\/x\/y: connection refused/);
    });

    it('handles a non-Error rejection with the Unknown error fallback', async () => {
      vi.stubGlobal('window', { fetch: vi.fn().mockRejectedValue('weird') });
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.fetch('http://x/y')).rejects.toThrow(/Unknown error/);
    });
  });

  describe('unzip', () => {
    it('is unsupported in the browser', async () => {
      const adapter = new BrowserFilesystemAdapter();
      await expect(adapter.unzip('/a.zip', '/out')).rejects.toThrow(/ZIP extraction not supported in browser/);
    });
  });

  describe('isSupported', () => {
    it('returns true when indexedDB is present', () => {
      expect(BrowserFilesystemAdapter.isSupported()).toBe(true);
    });

    it('returns false when indexedDB is undefined', () => {
      vi.stubGlobal('indexedDB', undefined);
      expect(BrowserFilesystemAdapter.isSupported()).toBe(false);
    });
  });

  describe('getStorageUsage / estimateStorageUsage', () => {
    it('returns the estimate when navigator.storage.estimate is available', async () => {
      vi.stubGlobal('navigator', {
        storage: { estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 1000 }) },
      });
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getStorageUsage()).toEqual({ used: 100, available: 900 });
    });

    it('defaults usage/available when estimate fields are missing', async () => {
      vi.stubGlobal('navigator', {
        storage: { estimate: vi.fn().mockResolvedValue({}) },
      });
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getStorageUsage()).toEqual({ used: 0, available: undefined });
    });

    it('returns { used: 0 } and warns when estimate throws', async () => {
      vi.stubGlobal('navigator', {
        storage: { estimate: vi.fn().mockRejectedValue(new Error('denied')) },
      });
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getStorageUsage()).toEqual({ used: 0 });
    });

    it('returns { used: 0 } when the storage API is absent', async () => {
      vi.stubGlobal('navigator', {});
      const adapter = new BrowserFilesystemAdapter();
      expect(await adapter.getStorageUsage()).toEqual({ used: 0 });
    });
  });
});
