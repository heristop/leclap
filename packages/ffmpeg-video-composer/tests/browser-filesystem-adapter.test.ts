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

  it('resolves old GitHub raw bundled asset URLs through the app public assets', async () => {
    const fs = new BrowserFilesystemAdapter();
    (window.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer,
    });

    const path = await fs.resolveLocalAsset(
      'https://github.com/heristop/ffmpeg-video-composer/raw/main/src/shared/assets/videos/leclap_bumper.mp4'
    );

    expect(window.fetch).toHaveBeenCalledWith('/assets/videos/leclap_bumper.mp4');
    expect(path).toBe('/tmp/fetch/leclap_bumper.mp4');
    expect(await fs.readFile('/tmp/fetch/leclap_bumper.mp4')).toEqual(new Uint8Array([7, 8, 9]));
  });

  it('falls back to remote fetching when a bundled public asset is unavailable', async () => {
    const fs = new BrowserFilesystemAdapter();
    (window.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(
      fs.resolveLocalAsset(
        'https://github.com/heristop/ffmpeg-video-composer/raw/main/src/shared/assets/videos/missing.mp4'
      )
    ).resolves.toBeNull();
  });
});
