import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import MusicWasmAdapter from '../src/platform/ffmpeg/MusicWasmAdapter';

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFilesystem() {
  return {
    getBuildDir: vi.fn(() => '/tmp/build'),
    move: vi.fn(async () => undefined),
  };
}

function registerFfmpeg(getInfos: unknown, execute: unknown) {
  container.registerInstance('ffmpegAdapter', { getInfos, execute } as never);
}

describe('MusicWasmAdapter.process', () => {
  beforeEach(() => {
    container.clearInstances();
  });

  it('loops the track when it is shorter than the video', async () => {
    const execute = vi.fn(async () => ({ rc: 0 }));
    registerFfmpeg(vi.fn(async () => ({ duration: 10, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), execute);
    const fs = makeFilesystem();
    const logger = makeLogger();

    const result = await new MusicWasmAdapter().process(logger as never, fs as never, 30, '/assets/musics/song.mp3');

    expect(result.rc).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    const command = (execute.mock.calls[0] as string[])[0];
    expect(command).toContain('-stream_loop -1');
    expect(command).toContain('-i /assets/musics/song.mp3');
    expect(command).toContain('-t 30');
    expect(fs.move).toHaveBeenCalledWith('/tmp/build/loop_music.mp3', '/assets/musics/song.mp3');
  });

  it('does nothing when the track already covers the video', async () => {
    const execute = vi.fn(async () => ({ rc: 0 }));
    registerFfmpeg(vi.fn(async () => ({ duration: 60, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), execute);
    const fs = makeFilesystem();

    const result = await new MusicWasmAdapter().process(makeLogger() as never, fs as never, 30, '/m.mp3');

    expect(result.rc).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    expect(fs.move).not.toHaveBeenCalled();
  });

  it('throws when the loop command fails', async () => {
    registerFfmpeg(vi.fn(async () => ({ duration: 5, videoCodec: null, audioCodec: 'mp3', sampleRate: null })), vi.fn(async () => ({ rc: 1 })));

    await expect(new MusicWasmAdapter().process(makeLogger() as never, makeFilesystem() as never, 30, '/m.mp3')).rejects.toThrow();
  });
});
