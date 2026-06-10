import { describe, it, expect, vi } from 'vitest';
import FFmpegLeclapAdapter, { type NativeEngine } from '../src/platform/ffmpeg/FFmpegLeclapAdapter';
import { parseCommand } from '../src/platform/ffmpeg/parseCommand';

describe('parseCommand', () => {
  it('splits args and keeps a quoted filtergraph (incl. inner single quotes) intact', () => {
    const cmd = `-y -i in.mp4 -filter_complex "drawtext=text='Hi There':x=10" out.mp4`;
    expect(parseCommand(cmd)).toEqual([
      '-y',
      '-i',
      'in.mp4',
      '-filter_complex',
      "drawtext=text='Hi There':x=10",
      'out.mp4',
    ]);
  });
});

function engineWith(overrides: Partial<NativeEngine>): NativeEngine {
  return {
    run: vi.fn().mockResolvedValue({ code: 0, log: '' }),
    probe: vi.fn().mockResolvedValue({ code: 0, output: '{"streams":[]}' }),
    ...overrides,
  };
}

describe('FFmpegLeclapAdapter', () => {
  it('execute() parses the command to argv and runs it natively', async () => {
    const run = vi.fn().mockResolvedValue({ code: 0, log: '' });
    const adapter = new FFmpegLeclapAdapter(engineWith({ run }));

    const result = await adapter.execute('-y -i a.mp4 -vf scale=1280:720 out.mp4');

    expect(result).toEqual({ rc: 0 });
    expect(run).toHaveBeenCalledWith(['-y', '-i', 'a.mp4', '-vf', 'scale=1280:720', 'out.mp4']);
  });

  it('execute() throws with the captured log when the engine returns a non-zero exit code', async () => {
    const adapter = new FFmpegLeclapAdapter(
      engineWith({ run: vi.fn().mockResolvedValue({ code: 1, log: 'Error: bad filter' }) })
    );

    await expect(adapter.execute('-y -i a.mp4 out.mp4')).rejects.toThrow(/bad filter/);
  });

  it('getInfos() maps ffprobe JSON to FFMpegInfos', async () => {
    const probeJson = JSON.stringify({
      streams: [
        { codec_type: 'video', codec_name: 'h264', duration: '8.00' },
        { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000' },
      ],
    });
    const probe = vi.fn().mockResolvedValue({ code: 0, output: probeJson });
    const adapter = new FFmpegLeclapAdapter(engineWith({ probe }));

    const infos = await adapter.getInfos('clip.mp4');

    expect(infos).toEqual({ duration: 8, videoCodec: 'h264', audioCodec: 'aac', sampleRate: 48000 });
    expect(probe).toHaveBeenCalledWith(['-v', 'quiet', '-print_format', 'json', '-show_streams', 'clip.mp4']);
  });

  it('getInfos() throws on a non-zero probe', async () => {
    const adapter = new FFmpegLeclapAdapter(engineWith({ probe: vi.fn().mockResolvedValue({ code: 1, output: '' }) }));

    await expect(adapter.getInfos('x.mp4')).rejects.toThrow(/FFprobe analysis failed/);
  });
});
