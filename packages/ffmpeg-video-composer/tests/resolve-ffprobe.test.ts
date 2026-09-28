import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveStaticFfprobe } from '@/platform/ffmpeg/resolve-ffprobe';

// Real files and the real existsSync: the bug guarded here is trusting an ffprobe path that was never
// on disk. Only package resolution is faked, since this repo doesn't install ffprobe-static.
let binDir: string;

function touch(name: string): string {
  const file = path.join(binDir, name);
  writeFileSync(file, '');

  return file;
}

function notInstalled(id: string): never {
  throw Object.assign(new Error(`Cannot find module '${id}'`), { code: 'MODULE_NOT_FOUND' });
}

function ffprobeStaticAt(binaryPath: string) {
  return (id: string) => {
    if (id !== 'ffprobe-static') {
      return notInstalled(id);
    }

    return { path: binaryPath };
  };
}

const withoutFfprobeStatic = { requireModule: notInstalled, exists: existsSync };

beforeEach(() => {
  binDir = mkdtempSync(path.join(tmpdir(), 'fvc-ffprobe-'));
});

afterEach(() => {
  rmSync(binDir, { recursive: true, force: true });
});

describe('resolveStaticFfprobe', () => {
  it('returns null when ffmpeg-static ships only its ffmpeg binary', () => {
    const ffmpeg = touch('ffmpeg');

    expect(resolveStaticFfprobe(ffmpeg, withoutFfprobeStatic)).toBeNull();
  });

  it('returns null when ffmpeg-static has no binary for this platform', () => {
    expect(resolveStaticFfprobe(null, withoutFfprobeStatic)).toBeNull();
  });

  it('uses the ffprobe-static binary when that package is installed', () => {
    const ffmpeg = touch('ffmpeg');
    const ffprobe = touch('ffprobe-static-darwin-arm64');

    expect(resolveStaticFfprobe(ffmpeg, { requireModule: ffprobeStaticAt(ffprobe), exists: existsSync })).toBe(ffprobe);
  });

  it('skips ffprobe-static when it has no binary for this platform', () => {
    const ffmpeg = touch('ffmpeg');
    const unbuilt = path.join(binDir, 'bin', 'freebsd', 'arm64', 'ffprobe');

    expect(resolveStaticFfprobe(ffmpeg, { requireModule: ffprobeStaticAt(unbuilt), exists: existsSync })).toBeNull();
  });

  it('uses an ffprobe that sits next to the ffmpeg binary', () => {
    const ffmpeg = touch('ffmpeg');
    touch('ffprobe');

    expect(resolveStaticFfprobe(ffmpeg, withoutFfprobeStatic)).toBe(path.join(binDir, 'ffprobe'));
  });

  it('keeps the .exe suffix when looking beside a Windows ffmpeg.exe', () => {
    const ffmpeg = touch('ffmpeg.exe');
    touch('ffprobe.exe');

    expect(resolveStaticFfprobe(ffmpeg, withoutFfprobeStatic)).toBe(path.join(binDir, 'ffprobe.exe'));
  });

  it('never hands back the ffmpeg binary itself when its name has no ffprobe counterpart', () => {
    // FFMPEG_BIN may point at any file name; ffmpeg run with ffprobe's flags is not a prober.
    const ffmpeg = touch('ffmpeg-6.1');

    expect(resolveStaticFfprobe(ffmpeg, withoutFfprobeStatic)).toBeNull();
  });
});
