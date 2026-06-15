import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// FilesystemNodeAdapter imports axios + node:dns at module load for the remote-fetch path;
// mock them so constructing the adapter never reaches the network even though these tests
// exercise the OFFLINE (local-asset) branch.
vi.mock('axios', () => {
  const mock = vi.fn() as ReturnType<typeof vi.fn> & { get: ReturnType<typeof vi.fn> };
  mock.get = vi.fn();

  return { default: mock };
});
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// resolveLocalAsset is the offline-first lookup AssetManager uses before downloading: a template may
// reference an asset as a path relative to assetsDir (e.g. `videos/earth.mp4`), and it must resolve
// to the staged file — subdirectories preserved — without hitting the network. fetch() is the
// fallback when nothing is staged locally.
describe('FilesystemNodeAdapter.resolveLocalAsset (offline-first, relative paths)', () => {
  let assetsDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-assets-'));
    await fs.mkdir(path.join(assetsDir, 'videos'), { recursive: true });
    await fs.writeFile(path.join(assetsDir, 'videos', 'earth.mp4'), 'video bytes');
  });

  afterEach(async () => {
    await fs.rm(assetsDir, { recursive: true, force: true });
  });

  const makeAdapter = (): FilesystemNodeAdapter => {
    const adapter = new FilesystemNodeAdapter(logger as never);
    adapter.setAssetsDir(assetsDir);

    return adapter;
  };

  it('resolves a relative asset path (subdir preserved) to the staged file under assetsDir', async () => {
    const resolved = await makeAdapter().resolveLocalAsset('videos/earth.mp4');

    expect(resolved).toBe(await fs.realpath(path.join(assetsDir, 'videos', 'earth.mp4')));
  });

  it('returns null for a relative path that is not staged (so the caller falls back to fetch)', async () => {
    expect(await makeAdapter().resolveLocalAsset('videos/missing.mp4')).toBeNull();
  });

  it('returns null for an out-of-tree path (no traversal out of the staged dirs)', async () => {
    expect(await makeAdapter().resolveLocalAsset('/etc/passwd')).toBeNull();
  });

  it('fetch() copies a relative staged asset without touching the network', async () => {
    const dest = await makeAdapter().fetch('videos/earth.mp4');

    expect(await fs.readFile(dest, 'utf-8')).toBe('video bytes');

    await fs.unlink(dest).catch(() => undefined);
  });
});
