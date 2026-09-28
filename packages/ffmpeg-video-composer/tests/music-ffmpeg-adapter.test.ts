import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import MusicFFmpegAdapter from '../src/platform/ffmpeg/MusicFFmpegAdapter';

// On device the track is the app's staged copy under its asset cache, which the app stages once and reuses
// on every later render (it skips a track that is already there) — so a loop written over it would stick.
const STAGED_TRACK = '/cache/leclap-assets/musics/song.mp3';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFilesystem() {
  return {
    getBuildDir: vi.fn(() => '/cache/leclap-build'),
    move: vi.fn(async () => undefined),
  };
}

function registerFfmpeg(trackSeconds: number, execute: (command: string) => Promise<{ rc: number }>) {
  const getInfos = vi.fn(async () => ({
    duration: trackSeconds,
    videoCodec: null,
    audioCodec: 'mp3',
    sampleRate: null,
  }));
  container.registerInstance('ffmpegAdapter', { getInfos, execute } as never);
}

describe('MusicFFmpegAdapter.process', () => {
  beforeEach(() => {
    container.clearInstances();
  });

  it('loops a short track into the build dir and returns that copy, leaving the staged track untouched', async () => {
    const execute = vi.fn<(command: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 }));
    registerFfmpeg(10, execute);
    const fs = makeFilesystem();

    const result = await new MusicFFmpegAdapter().process(makeLogger() as never, fs as never, 30, STAGED_TRACK);

    expect(result).toEqual({ rc: 0, musicPath: '/cache/leclap-build/loop_music.m4a' });
    const command = execute.mock.calls[0][0];
    expect(command).toContain(`-stream_loop -1 -i ${STAGED_TRACK} -t 30`);
    expect(command).toContain('/cache/leclap-build/loop_music.m4a');
    expect(fs.move).not.toHaveBeenCalled();
  });

  it('returns the staged track itself when it already covers the video', async () => {
    const execute = vi.fn<(command: string) => Promise<{ rc: number }>>(async () => ({ rc: 0 }));
    registerFfmpeg(60, execute);
    const fs = makeFilesystem();

    const result = await new MusicFFmpegAdapter().process(makeLogger() as never, fs as never, 30, STAGED_TRACK);

    expect(result).toEqual({ rc: 0, musicPath: STAGED_TRACK });
    expect(execute).not.toHaveBeenCalled();
    expect(fs.move).not.toHaveBeenCalled();
  });
});
