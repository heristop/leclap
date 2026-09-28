import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import type AbstractFFmpeg from '@/platform/ffmpeg/AbstractFFmpeg';
import FFmpegNodeAdapter from '@/platform/ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from '@/platform/ffmpeg/FFmpegStaticAdapter';

// The Node CLI adapters run a real ffmpeg: the system one, or ffmpeg-static's 6.0 build. The FFmpegError
// they throw when it fails is the reason a host shows its user, so it has to carry the lines FFmpeg
// failed on rather than everything FFmpeg printed.

// A crop wider than its input only fails once FFmpeg configures the filters, after it has opened the
// inputs and mapped the streams. FFmpeg 8 then logs the teardown of every stage after the cause.
const oversizedCrop =
  '-f lavfi -i testsrc=duration=1:size=320x240 -f lavfi -i sine=duration=1 -vf crop=w=400:h=100 -c:v libx264 -c:a aac -f null -';

async function failureOf(adapter: AbstractFFmpeg, command: string): Promise<string> {
  try {
    await adapter.execute(command);
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error(`expected \`ffmpeg ${command}\` to fail`);
}

describe.each([
  { binary: 'the system ffmpeg', adapter: () => new FFmpegNodeAdapter() },
  { binary: 'ffmpeg-static', adapter: () => new FFmpegStaticAdapter() },
])('a failed command on $binary', ({ adapter }) => {
  it('reports the cause, clear of the banner and the input dumps', async () => {
    const message = await failureOf(adapter(), oversizedCrop);

    expect(message).toContain('Invalid too big or non positive size');
    expect(message).not.toMatch(/ffmpeg version|configuration:|libavutil/);
    expect(message).not.toMatch(/^Input #\d|^\s*Stream #\d|^Stream mapping:/m);
  });
});
