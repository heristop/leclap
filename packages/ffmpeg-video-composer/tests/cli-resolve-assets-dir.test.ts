import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAssetsDir } from '../src/cli/resolveAssetsDir';

const here = path.dirname(fileURLToPath(import.meta.url));
// The CLI entry module sits one level under the package root at runtime — `src/cli.ts` in dev,
// `dist/cli.js` once built — and passes its own directory as `moduleDir`. `tests/../src` mirrors
// that depth so the bundled-asset resolution matches what the real CLI computes.
const cliModuleDir = path.resolve(here, '../src');

describe('resolveAssetsDir', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'leclap-cli-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('falls back to the bundled creative-kit library when the cwd has no local assets', () => {
    const dir = resolveAssetsDir(cwd, cliModuleDir);

    // Non-regression guard: the fallback must point at a directory that actually exists and holds the
    // demo media. This is what broke when src/assets was merged into src/library — a stale path that
    // fails existsSync silently falls through to a non-existent <cwd>/assets and the render dies.
    expect(dir).toBe(path.resolve(cliModuleDir, '../../creative-kit/src/library'));
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(path.join(dir, 'videos/video_1.mp4'))).toBe(true);
    expect(existsSync(path.join(dir, 'musics/go-by-ocean.mp3'))).toBe(true);
  });

  it('prefers the cwd-local assets dir when one is present', () => {
    mkdirSync(path.join(cwd, 'assets'));

    expect(resolveAssetsDir(cwd, cliModuleDir)).toBe(path.join(cwd, 'assets'));
  });
});
