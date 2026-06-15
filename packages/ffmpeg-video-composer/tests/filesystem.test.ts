import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock node:fs (the source imports { promises as fs, createWriteStream } from 'node:fs') ---
// Use vi.hoisted so these are initialised before the hoisted vi.mock factories run.
const { fsMocks, createWriteStreamMock, axiosMock, axiosGetMock, extractMock } = vi.hoisted(() => ({
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
  },
  createWriteStreamMock: vi.fn(),
  axiosMock: vi.fn(),
  axiosGetMock: vi.fn(),
  extractMock: vi.fn(),
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

// --- Mock extract-zip (used by unzip) ---
vi.mock('extract-zip', () => ({
  default: (...args: unknown[]) => extractMock(...args),
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

  describe('getAssetsPath', () => {
    it('joins the root with the creative-kit assets path', async () => {
      const result = await adapter.getAssetsPath('videos');
      expect(result).toBe([process.cwd(), 'packages', 'creative-kit', 'src', 'assets', 'videos'].join('/'));
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
      expect(dest).toBe('/tmp/video.mp4');
      expect(axiosMock).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://example.com/video.mp4',
        responseType: 'stream',
        maxRedirects: 0,
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
      expect(fsMocks.unlink).toHaveBeenCalledWith('/tmp/video.mp4');
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

  describe('unzip', () => {
    it('extracts and returns the list of files joined to the target dir', async () => {
      extractMock.mockResolvedValue(undefined);
      fsMocks.readdir.mockResolvedValue(['a.txt', 'b.txt']);
      const result = await adapter.unzip('/archive.zip', '/out');
      expect(extractMock).toHaveBeenCalledWith('/archive.zip', { dir: '/out' });
      expect(result).toEqual(['/out/a.txt', '/out/b.txt']);
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
    unzip = async () => [];
    fetchAndRead = async () => '';
  }

  it('returns undefined for unset dirs', () => {
    const fs = new StubFilesystem();
    expect(fs.getBuildDir()).toBeUndefined();
    expect(fs.getRootDir()).toBeUndefined();
    expect(fs.getTempDir()).toBeUndefined();
    expect(fs.getAssetsDir('videos')).toBe('undefined/videos');
  });
});
