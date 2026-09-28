import 'reflect-metadata';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { container } from 'tsyringe';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FFmpegDeviceAdapter, { type NativeEngine } from '@/platform/ffmpeg/FFmpegDeviceAdapter';
import MusicFFmpegAdapter from '@/platform/ffmpeg/MusicFFmpegAdapter';
import { MUSIC_TRACK_FORMATS, writeMusicTrack } from './fixtures/music-track-formats';

const execFileAsync = promisify(execFile);

// The on-device loop, with host ffmpeg/ffprobe standing in for the native engine behind the real device
// adapter. The engine builds the PNG decoder and H.264 encoders too, so a cover image left in the loop is
// re-encoded to an H.264 cover, which the m4a muxer rejects there just as it does here.
const TRACK_SECONDS = 1.5;
const VIDEO_SECONDS = 3.5;

const hostEngine: NativeEngine = {
  run: async (args) => {
    try {
      await execFileAsync('ffmpeg', args);

      return { code: 0, log: '' };
    } catch (error) {
      const failure = error as { code?: unknown; stderr?: string };

      return { code: typeof failure.code === 'number' ? failure.code : 1, log: failure.stderr ?? '' };
    }
  },
  probe: async (args) => {
    const { stdout } = await execFileAsync('ffprobe', args);

    return { code: 0, output: stdout };
  },
};

async function probeLoop(filePath: string): Promise<{ duration: number; streams: string[] }> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type',
    '-of',
    'json',
    filePath,
  ]);
  const info = JSON.parse(stdout) as { format: { duration: string }; streams: Array<{ codec_type: string }> };

  return { duration: Number(info.format.duration), streams: info.streams.map((stream) => stream.codec_type) };
}

describe('MusicFFmpegAdapter loop across track formats — host FFmpeg', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fvc-device-music-formats-'));

    for (const track of MUSIC_TRACK_FORMATS) {
      await writeMusicTrack(path.join(workDir, `${track.name}.mp3`), track.args(TRACK_SECONDS));
    }
  });

  afterAll(async () => {
    await fs.rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    container.clearInstances();
    container.registerInstance('ffmpegAdapter', new FFmpegDeviceAdapter(hostEngine));
  });

  it.each(MUSIC_TRACK_FORMATS)('loops $format to the video length, as audio only', async ({ name }) => {
    const buildDir = await fs.mkdtemp(path.join(workDir, 'build-'));
    const filesystem = { getBuildDir: () => buildDir };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const { musicPath } = await new MusicFFmpegAdapter().process(
      logger as never,
      filesystem as never,
      VIDEO_SECONDS,
      path.join(workDir, `${name}.mp3`)
    );

    const loop = await probeLoop(musicPath);
    expect(loop.streams).toEqual(['audio']);
    expect(loop.duration).toBeCloseTo(VIDEO_SECONDS, 1);
  });
});
