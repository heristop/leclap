import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import FilesystemNodeAdapter from '@/platform/filesystem/FilesystemNodeAdapter';
import type AbstractLogger from '@/platform/logging/AbstractLogger';

const silent: AbstractLogger = { debug() {}, info() {}, warn() {}, error() {} };

// The adapter as a BUILT consumer runs it — the CLI and the MCP server load it from the engine's
// `dist/` — standing in a synthetic monorepo checkout rather than in `src/platform/filesystem/`.
class DistAdapter extends FilesystemNodeAdapter {
  constructor(private readonly dir: string) {
    super(silent);
  }

  protected override bundledModuleDir(): string {
    return this.dir;
  }
}

describe('FilesystemNodeAdapter bundled assets from a built dist/', () => {
  let root: string;
  let library: string;
  let adapter: DistAdapter;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'fvc-bundled-'));
    library = path.join(root, 'repo', 'packages', 'leclap-creative-kit', 'src', 'library');
    await mkdir(path.join(library, 'fonts'), { recursive: true });
    await mkdir(path.join(library, 'musics'), { recursive: true });
    await writeFile(path.join(library, 'fonts', 'Oswald.ttf'), 'font bytes');
    // What a checkout without LFS content holds for every library track.
    await writeFile(path.join(library, 'musics', 'pop.mp3'), 'version https://git-lfs.github.com/spec/v1\n');

    const dist = path.join(root, 'repo', 'packages', 'ffmpeg-video-composer', 'dist');
    await mkdir(dist, { recursive: true });
    adapter = new DistAdapter(dist);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('walks up to the creative kit for a font', async () => {
    await expect(adapter.resolveBundledFont('Oswald.ttf')).resolves.toBe(path.join(library, 'fonts', 'Oswald.ttf'));
  });

  // A library track may be an LFS pointer, and MusicNodeAdapter.loopMusic rewrites the resolved file
  // in place — so a built render must never be handed the tracked copy; it downloads the track.
  it('never resolves music into the tracked library', async () => {
    await expect(adapter.resolveBundledMusic('pop.mp3')).resolves.toBeNull();
  });

  it('refuses a name that is not a bare file name', async () => {
    await expect(adapter.resolveBundledFont('../fonts/Oswald.ttf')).resolves.toBeNull();
  });
});
