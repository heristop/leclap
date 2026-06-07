import 'reflect-metadata';
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BrowserFilesystemAdapter from '../src/platform/filesystem/BrowserFilesystemAdapter';

describe('BrowserFilesystemAdapter.fetch', () => {
  beforeEach(() => {
    // The adapter calls window.fetch for remote URLs; stub a window in the node env.
    vi.stubGlobal('window', { fetch: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a local path that already exists without hitting the network', async () => {
    const fs = new BrowserFilesystemAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await fs.writeFile('/assets/pictures/bg.png', bytes);

    const path = await fs.fetch('/assets/pictures/bg.png');

    expect(path).toBe('/tmp/fetch/bg.png');
    expect(await fs.readFile(path)).toEqual(bytes);
    expect(window.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('falls through to window.fetch for a local path that does not exist', async () => {
    const fs = new BrowserFilesystemAdapter();
    (window.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9]).buffer,
    });

    await fs.fetch('/not/in/store.png');

    expect(window.fetch).toHaveBeenCalledWith('/not/in/store.png');
  });
});
