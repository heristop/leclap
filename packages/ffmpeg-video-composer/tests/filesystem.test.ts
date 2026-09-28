import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock node:fs (the source imports { promises as fs, createWriteStream } from 'node:fs') ---
// Use vi.hoisted so these are initialised before the hoisted vi.mock factories run.
const { fsMocks, createWriteStreamMock, axiosMock, axiosGetMock } = vi.hoisted(() => ({
  fsMocks: {
    mkdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    copyFile: vi.fn(),
    rename: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    readdir: vi.fn(),
    realpath: vi.fn(),
  },
  createWriteStreamMock: vi.fn(),
  axiosMock: vi.fn(),
  axiosGetMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  promises: fsMocks,
  createWriteStream: (...args: unknown[]) => createWriteStreamMock(...args),
}));

vi.mock('node:os', () => ({
  default: {
    tmpdir: () => '/tmp',
  },
}));

// --- Mock axios (used by fetch / fetchAndRead) ---
vi.mock('axios', () => ({
  default: Object.assign((...args: unknown[]) => axiosMock(...args), {
    get: (...args: unknown[]) => axiosGetMock(...args),
  }),
}));

// --- Mock node:dns/promises (used by the SSRF guard in fetch / fetchAndRead) ---
// Resolve every hostname to a public address so the guard lets remote fetches through
// without touching a real resolver.
vi.mock('node:dns/promises', () => ({
  lookup: () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
}));

import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';
import AbstractFilesystem from '@/platform/filesystem/AbstractFilesystem';

const makeLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('FilesystemNodeAdapter', () => {
  let logger: ReturnType<typeof makeLogger>;
  let adapter: FilesystemNodeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = makeLogger();
    adapter = new FilesystemNodeAdapter(logger as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AbstractFilesystem getters/setters (inherited)', () => {
    it('exposes the root dir as the cwd', () => {
      expect(adapter.getRootDir()).toBe(process.cwd());
    });

    it('exposes the temp dir from os.tmpdir()', () => {
      expect(adapter.getTempDir()).toBe('/tmp');
    });

    it('set/get build dir round-trips', () => {
      adapter.setBuildDir('/build');
      expect(adapter.getBuildDir()).toBe('/build');
    });

    it('set/get assets dir round-trips with type suffix', () => {
      adapter.setAssetsDir('/assets');
      expect(adapter.getAssetsDir('videos')).toBe('/assets/videos');
    });

    it('setSegment influences getSource/getDestination', () => {
      adapter.setSegment('intro');
      adapter.setAssetsDir('/assets');
      adapter.setBuildDir('/build');
      expect(adapter.getSource(undefined)).toBe('/assets/videos/intro.mp4');
      expect(adapter.getDestination()).toBe('/build/intro_output.mp4');
    });
  });

  describe('resolveLocalAsset', () => {
    // realpath echoes its input so resolveStagedPath returns the candidate (and the staging roots resolve
    // to themselves), letting us assert the candidate-path mapping without a real filesystem.
    beforeEach(() => fsMocks.realpath.mockImplementation(async (p: string) => p));

    it('maps a web-rooted /assets/... url under assetsDir (not as a device path)', async () => {
      adapter.setAssetsDir('/staged');
      // A `/assets/...` reference is what the web builder emits; it must resolve under assetsDir, not as
      // the literal filesystem path `/assets/...` (which would ENOENT and break compilation).
      expect(await adapter.resolveLocalAsset('/assets/animations/glow_border.apng')).toBe(
        '/staged/animations/glow_border.apng'
      );
    });

    it('keeps a relative path assets-relative', async () => {
      adapter.setAssetsDir('/staged');
      expect(await adapter.resolveLocalAsset('animations/border.apng')).toBe('/staged/animations/border.apng');
    });

    it('uses a real staged device path (no /assets/ marker) as-is', async () => {
      adapter.setAssetsDir('/staged');
      expect(await adapter.resolveLocalAsset('/tmp/recorded.mp4')).toBe('/tmp/recorded.mp4');
    });
  });

  describe('getAssetsPath', () => {
    it('joins the root with the leclap-creative-kit assets path', async () => {
      const result = await adapter.getAssetsPath('videos');
      expect(result).toBe([process.cwd(), 'packages', 'leclap-creative-kit', 'src', 'assets', 'videos'].join('/'));
    });
  });

  describe('getBuildPath', () => {
    it('creates the directory recursively and returns the full path', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined);
      adapter.setBuildDir('/build');
      const result = await adapter.getBuildPath('out');
      expect(result).toBe('/build/out');
      expect(fsMocks.mkdir).toHaveBeenCalledWith('/build/out', { recursive: true });
    });

    it('falls back to empty base when buildDir is undefined', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined);
      const result = await adapter.getBuildPath('out');
      expect(result).toBe('out');
    });
  });

  describe('getSource', () => {
    it('uses the provided segment name', () => {
      adapter.setAssetsDir('/assets');
      expect(adapter.getSource('clip')).toBe('/assets/videos/clip.mp4');
    });

    it('returns empty string when no segment name available', () => {
      adapter.setAssetsDir('/assets');
      expect(adapter.getSource(undefined)).toBe('');
    });
  });

  describe('fetch', () => {
    it('streams a download to disk and resolves with the destination path', async () => {
      const dataStream = { on: vi.fn(), pipe: vi.fn() };
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: dataStream });

      const writer = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'finish') {
            // simulate the write finishing asynchronously
            setImmediate(cb);
          }
        }),
        destroy: vi.fn(),
      };
      createWriteStreamMock.mockReturnValue(writer);

      const dest = await adapter.fetch('http://example.com/video.mp4');
      expect(dest).toMatch(/^\/tmp\/[\w-]+-video\.mp4$/);
      expect(axiosMock).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://example.com/video.mp4',
        responseType: 'stream',
        maxRedirects: 0,
        // Non-keep-alive agents so the download socket closes when the response ends (see
        // filesystem-fetch.test.ts) and the process can exit instead of lingering ~25s.
        httpAgent: expect.objectContaining({ keepAlive: false }),
        httpsAgent: expect.objectContaining({ keepAlive: false }),
        validateStatus: expect.any(Function),
      });
      expect(dataStream.pipe).toHaveBeenCalledWith(writer);
    });

    it('cleans up the partial file and rethrows on stream error', async () => {
      const handlers: Record<string, (err: unknown) => void> = {};
      const dataStream = {
        on: vi.fn((event: string, cb: (err: unknown) => void) => {
          handlers[`data:${event}`] = cb;
        }),
        pipe: vi.fn(),
      };
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: dataStream });

      const writer = {
        on: vi.fn((event: string, cb: (err: unknown) => void) => {
          handlers[`writer:${event}`] = cb;
          if (event === 'finish') {
            // trigger the data error before finish fires
            setImmediate(() => handlers['data:error']?.(new Error('boom')));
          }
        }),
        destroy: vi.fn(),
      };
      createWriteStreamMock.mockReturnValue(writer);
      fsMocks.unlink.mockResolvedValue(undefined);

      await expect(adapter.fetch('http://example.com/video.mp4')).rejects.toThrow('boom');
      expect(writer.destroy).toHaveBeenCalled();
      expect(fsMocks.unlink).toHaveBeenCalledWith(createWriteStreamMock.mock.calls[0][0]);
    });

    // Concurrent renders (MCP workers), or two requests for one font face in a section, fetching the
    // same URL must not share a temp file: the second open truncates the first download mid-write,
    // and whichever finishes first carries a zero-filled hole onward (into the font cache, even).
    it('gives every download its own temp file', async () => {
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: { on: vi.fn(), pipe: vi.fn() } });
      createWriteStreamMock.mockReturnValue({
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'finish') {
            setImmediate(cb);
          }
        }),
        destroy: vi.fn(),
      });

      const first = await adapter.fetch('https://fonts.gstatic.com/s/roboto/v51/face.ttf');
      const second = await adapter.fetch('https://fonts.gstatic.com/s/roboto/v51/face.ttf');

      expect(first).not.toBe(second);
      expect(first).toMatch(/^\/tmp\/[\w-]+-face\.ttf$/);
    });

    it('swallows unlink failure during cleanup', async () => {
      const handlers: Record<string, (err: unknown) => void> = {};
      const dataStream = {
        on: vi.fn((event: string, cb: (err: unknown) => void) => {
          handlers[`data:${event}`] = cb;
        }),
        pipe: vi.fn(),
      };
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: dataStream });

      const writer = {
        on: vi.fn((event: string, cb: (err: unknown) => void) => {
          if (event === 'error') {
            setImmediate(() => cb(new Error('writer-fail')));
          }
        }),
        destroy: vi.fn(),
      };
      createWriteStreamMock.mockReturnValue(writer);
      fsMocks.unlink.mockRejectedValue(new Error('cannot unlink'));

      await expect(adapter.fetch('http://example.com/a.mp4')).rejects.toThrow('writer-fail');
      expect(writer.destroy).toHaveBeenCalled();
    });
  });

  describe('stat', () => {
    it('returns true when the file exists', async () => {
      fsMocks.stat.mockResolvedValue({});
      expect(await adapter.stat('/some/file')).toBe(true);
    });

    it('returns false when stat throws', async () => {
      fsMocks.stat.mockRejectedValue(new Error('ENOENT'));
      expect(await adapter.stat('/missing')).toBe(false);
    });
  });

  describe('read / readFile', () => {
    it('reads a file as utf-8 text', async () => {
      fsMocks.readFile.mockResolvedValue('hello');
      expect(await adapter.read('/f.txt')).toBe('hello');
      expect(fsMocks.readFile).toHaveBeenCalledWith('/f.txt', 'utf-8');
    });

    it('reads a file as raw bytes', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      fsMocks.readFile.mockResolvedValue(bytes);
      expect(await adapter.readFile('/f.bin')).toBe(bytes);
      expect(fsMocks.readFile).toHaveBeenCalledWith('/f.bin');
    });
  });

  describe('copy', () => {
    it('delegates to fs.copyFile', async () => {
      fsMocks.copyFile.mockResolvedValue(undefined);
      await adapter.copy('/a', '/b');
      expect(fsMocks.copyFile).toHaveBeenCalledWith('/a', '/b');
    });
  });

  describe('move', () => {
    it('renames when the source exists', async () => {
      fsMocks.access.mockResolvedValue(undefined);
      fsMocks.rename.mockResolvedValue(undefined);
      await adapter.move('/a', '/b');
      expect(fsMocks.rename).toHaveBeenCalledWith('/a', '/b');
    });

    it('throws when the source does not exist', async () => {
      fsMocks.access.mockRejectedValue(new Error('nope'));
      await expect(adapter.move('/a', '/b')).rejects.toThrow('/a not found');
    });
  });

  describe('unlink / write / writeFile', () => {
    it('write truncates the file to empty', async () => {
      fsMocks.writeFile.mockResolvedValue(undefined);
      await adapter.write('/f');
      expect(fsMocks.writeFile).toHaveBeenCalledWith('/f', '');
    });

    it('unlink truncates then removes the file', async () => {
      fsMocks.writeFile.mockResolvedValue(undefined);
      fsMocks.unlink.mockResolvedValue(undefined);
      await adapter.unlink('/f');
      expect(fsMocks.unlink).toHaveBeenCalledWith('/f');
    });

    it('unlink still removes even if the pre-truncate write rejects', async () => {
      fsMocks.writeFile.mockRejectedValue(new Error('locked'));
      fsMocks.unlink.mockResolvedValue(undefined);
      await adapter.unlink('/f');
      expect(fsMocks.unlink).toHaveBeenCalledWith('/f');
    });

    it('writeFile writes raw bytes', async () => {
      const data = new Uint8Array([9]);
      fsMocks.writeFile.mockResolvedValue(undefined);
      await adapter.writeFile('/f.bin', data);
      expect(fsMocks.writeFile).toHaveBeenCalledWith('/f.bin', data);
    });
  });

  describe('append', () => {
    it('appends when the file exists', async () => {
      fsMocks.access.mockResolvedValue(undefined);
      fsMocks.appendFile.mockResolvedValue(undefined);
      await adapter.append('/log', 'line');
      expect(fsMocks.appendFile).toHaveBeenCalledWith('/log', 'line');
    });

    it("throws when the file doesn't exist", async () => {
      fsMocks.access.mockRejectedValue(new Error('missing'));
      await expect(adapter.append('/log', 'line')).rejects.toThrow("/log doesn't exist");
    });
  });

  describe('fetchAndRead', () => {
    it('returns the response body on success', async () => {
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: 'remote-content' });
      expect(await adapter.fetchAndRead('http://x/y')).toBe('remote-content');
    });

    it('logs and rethrows an Error on failure', async () => {
      axiosMock.mockRejectedValue(new Error('network down'));
      await expect(adapter.fetchAndRead('http://x/y')).rejects.toThrow('network down');
      expect(logger.error).toHaveBeenCalledWith('Error downloading from http://x/y:', {
        message: 'network down',
      });
    });

    it('logs with undefined params for non-Error rejections', async () => {
      axiosMock.mockRejectedValue('plain string');
      await expect(adapter.fetchAndRead('http://x/y')).rejects.toBe('plain string');
      expect(logger.error).toHaveBeenCalledWith('Error downloading from http://x/y:', undefined);
    });

    // Google keys the CSS format off the User-Agent, so the header the font resolver passes must
    // actually reach the request.
    it('forwards request headers', async () => {
      axiosMock.mockResolvedValue({ status: 200, headers: {}, data: 'css' });
      await adapter.fetchAndRead('https://fonts.googleapis.com/css2?family=Inter', { 'User-Agent': 'Mozilla/4.0' });
      expect(axiosMock).toHaveBeenCalledWith(expect.objectContaining({ headers: { 'User-Agent': 'Mozilla/4.0' } }));
    });

    // PlatformBridge builds this adapter with `new FilesystemNodeAdapter()`, outside DI: the failure
    // must surface as itself, not as a TypeError about the missing logger.
    it('rethrows the request error when built without a logger', async () => {
      axiosMock.mockRejectedValue(new Error('Request failed with status code 400'));
      await expect(new FilesystemNodeAdapter().fetchAndRead('http://x/y')).rejects.toThrow('status code 400');
    });
  });

  // The font cache outlives the build dir and is shared by concurrent renders: an entry must never be
  // observable half-written, it is keyed by a bare file name only, and it is best-effort.
  describe('persistent font cache', () => {
    beforeEach(() => {
      vi.stubEnv('FVC_FONT_CACHE_DIR', '/cache');
      fsMocks.mkdir.mockResolvedValue(undefined);
      fsMocks.copyFile.mockResolvedValue(undefined);
      fsMocks.rename.mockResolvedValue(undefined);
      fsMocks.unlink.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('resolves a cached face by name', async () => {
      fsMocks.stat.mockResolvedValue({});
      expect(await adapter.resolveCachedFont('google-inter-400.ttf')).toBe('/cache/google-inter-400.ttf');
    });

    it('misses when the face is not cached', async () => {
      fsMocks.stat.mockRejectedValue(new Error('ENOENT'));
      expect(await adapter.resolveCachedFont('google-inter-400.ttf')).toBeNull();
    });

    it('writes an entry under a temporary name, then renames it into place', async () => {
      await adapter.cacheFont('google-inter-400.ttf', '/build/fonts/google-inter-400.ttf');
      const [source, partial] = fsMocks.copyFile.mock.calls[0];
      expect(source).toBe('/build/fonts/google-inter-400.ttf');
      expect(partial).not.toBe('/cache/google-inter-400.ttf');
      expect(fsMocks.rename).toHaveBeenCalledWith(partial, '/cache/google-inter-400.ttf');
    });

    it('drops the temporary file when the copy fails', async () => {
      fsMocks.copyFile.mockRejectedValue(new Error('ENOSPC'));
      await adapter.cacheFont('google-inter-400.ttf', '/build/fonts/google-inter-400.ttf');
      const [, partial] = fsMocks.copyFile.mock.calls[0];
      expect(fsMocks.rename).not.toHaveBeenCalled();
      expect(fsMocks.unlink).toHaveBeenCalledWith(partial);
      expect(logger.warn).toHaveBeenCalled();
    });

    // A template-authored legacy name such as `Roboto-/../google-inter-700.ttf` would otherwise read
    // or overwrite files outside the cache dir — including another font's entry.
    it('ignores a name with a directory part', async () => {
      expect(await adapter.resolveCachedFont('Roboto-/../google-inter-700.ttf')).toBeNull();
      await adapter.cacheFont('Roboto-/../google-inter-700.ttf', '/build/fonts/x.ttf');
      expect(fsMocks.stat).not.toHaveBeenCalled();
      expect(fsMocks.copyFile).not.toHaveBeenCalled();
    });

    it('never fails the render when the cache cannot be written, even without a logger', async () => {
      fsMocks.mkdir.mockRejectedValue(new Error('EROFS: read-only file system'));
      await expect(
        new FilesystemNodeAdapter().cacheFont('google-inter-400.ttf', '/build/fonts/x.ttf')
      ).resolves.toBeUndefined();
    });
  });
});

describe('AbstractFilesystem (defaults via subclass)', () => {
  class StubFilesystem extends AbstractFilesystem {
    getAssetsPath = async () => '';
    getBuildPath = async () => '';
    getSource = () => '';
    getDestination = () => '';
    stat = async () => false;
    fetch = async () => '';
    write = async () => {};
    writeFile = async () => {};
    append = async () => {};
    unlink = async () => {};
    read = async () => '';
    readFile = async () => new Uint8Array();
    copy = async () => {};
    move = async () => {};
    fetchAndRead = async () => '';
  }

  // A platform that cannot request a TrueType face names every font-by-family ref it would fail on, so
  // the browser entry can refuse the template before encoding anything; others name none.
  it('lists the fonts named by family it cannot resolve', () => {
    const descriptor = { sections: [{ caption: { font: { family: 'Inter' } } }, { caption: { font: 'bebas' } }] };
    const offline = Object.assign(new StubFilesystem(), { supportsRemoteFonts: false });

    expect(new StubFilesystem().unresolvableFontRefs(descriptor)).toEqual([]);
    expect(offline.unresolvableFontRefs(descriptor)).toEqual(['sections[0].caption.font']);
  });

  it('returns undefined for unset dirs', () => {
    const fs = new StubFilesystem();
    expect(fs.getBuildDir()).toBeUndefined();
    expect(fs.getRootDir()).toBeUndefined();
    expect(fs.getTempDir()).toBeUndefined();
    expect(fs.getAssetsDir('videos')).toBe('undefined/videos');
  });

  // Non-regression: `tempDir` is never set on the browser path, so getTempDir() must fall back to the
  // build dir. Without this, MusicComposer/AnimationComposer build `undefined/tmp_*.mp4` and the
  // normalize / music-mix / animation steps read a non-existent file → spurious "Aborted()".
  it('falls back to the build dir for temp files when tempDir is unset', () => {
    const fs = new StubFilesystem();
    fs.setBuildDir('/tmp/build');

    expect(fs.getTempDir()).toBe('/tmp/build');
    // The exact path shape the composers assemble must be valid, not `undefined/...`.
    expect(`${fs.getTempDir()}/tmp_normalize_123.mp4`).toBe('/tmp/build/tmp_normalize_123.mp4');
  });
});
