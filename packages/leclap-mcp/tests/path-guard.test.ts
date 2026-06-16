import 'reflect-metadata';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertWithinMediaDir } from '../src/compose/pathGuard.js';

let mediaDir: string;
let outsideDir: string;

beforeEach(async () => {
  // realpath the temp roots up front: macOS resolves /var → /private/var, so the guard's
  // realpath comparison only lines up when the fixtures are themselves canonicalized.
  mediaDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-media-')));
  outsideDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-outside-')));
});

afterEach(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
  await fs.rm(outsideDir, { recursive: true, force: true });
});

describe('assertWithinMediaDir', () => {
  it('rejects a relative path', async () => {
    await expect(assertWithinMediaDir('relative/clip.mp4', mediaDir)).rejects.toThrow(/absolute/);
  });

  it('rejects a missing file', async () => {
    const missing = path.join(mediaDir, 'nope.mp4');
    await expect(assertWithinMediaDir(missing, mediaDir)).rejects.toThrow(/does not exist/);
  });

  it('rejects a file outside the media dir', async () => {
    const outside = path.join(outsideDir, 'clip.mp4');
    await fs.writeFile(outside, 'x');

    await expect(assertWithinMediaDir(outside, mediaDir)).rejects.toThrow(/escapes the media/);
  });

  it('rejects a traversal path that climbs out of the media dir', async () => {
    const outside = path.join(outsideDir, 'clip.mp4');
    await fs.writeFile(outside, 'x');
    const traversal = path.join(mediaDir, '..', path.basename(outsideDir), 'clip.mp4');

    await expect(assertWithinMediaDir(traversal, mediaDir)).rejects.toThrow(/escapes the media/);
  });

  it('rejects a symlink inside the media dir that escapes it', async () => {
    const target = path.join(outsideDir, 'secret.mp4');
    await fs.writeFile(target, 'x');
    const link = path.join(mediaDir, 'link.mp4');
    await fs.symlink(target, link);

    await expect(assertWithinMediaDir(link, mediaDir)).rejects.toThrow(/escapes the media/);
  });

  it('returns the realpath for a file inside the media dir', async () => {
    const clip = path.join(mediaDir, 'clip.mp4');
    await fs.writeFile(clip, 'x');

    await expect(assertWithinMediaDir(clip, mediaDir)).resolves.toBe(await fs.realpath(clip));
  });
});
