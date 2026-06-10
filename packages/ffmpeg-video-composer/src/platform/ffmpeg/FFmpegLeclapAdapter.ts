import AbstractFFmpeg from './AbstractFFmpeg';
import { parseCommand } from './parseCommand';
import { FFmpegError } from '../../core/errors/FFmpegError';
import type { FFMpegInfos } from '../../core/types';

/**
 * The native FFmpeg CLI engine (the `leclap-ffmpeg` Expo module), injected by the React-Native entry
 * so the platform-agnostic core never imports app/Expo code. `run` executes an ffmpeg command and
 * returns its exit code; `probe` runs ffprobe and returns its captured stdout.
 */
export interface NativeEngine {
  run(args: string[]): Promise<{ code: number; log: string }> | { code: number; log: string };
  probe(args: string[]): Promise<{ code: number; output: string }> | { code: number; output: string };
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  duration?: string;
  sample_rate?: string;
}

/**
 * Drives the on-device FFmpeg CLI engine. The core hands `execute()` a full command string (no
 * program name); we split it to argv and run it natively — no MEMFS bridging, since the engine reads
 * the real device paths the core wrote. `getInfos()` shells ffprobe to JSON and maps it to FFMpegInfos.
 */
class FFmpegLeclapAdapter extends AbstractFFmpeg {
  constructor(private readonly engine: NativeEngine) {
    super();
  }

  execute = async (command: string): Promise<{ rc: number }> => {
    const { code, log } = await this.engine.run(parseCommand(command));

    if (code !== 0) {
      // The captured stderr (`log`) is the actual ffmpeg error — surface its tail.
      const tail = log.split('\n').filter(Boolean).slice(-8).join('\n');

      throw new FFmpegError('FFmpeg command failed', `rc=${code}\n${tail}\ncmd: ffmpeg ${command}`);
    }

    return { rc: code };
  };

  getInfos = async (source: string): Promise<FFMpegInfos> => {
    const { code, output } = await this.engine.probe(['-v', 'quiet', '-print_format', 'json', '-show_streams', source]);

    if (code !== 0) {
      throw new FFmpegError(`FFprobe analysis failed for ${source}`, `rc=${code}`);
    }

    let streams: ProbeStream[] = [];

    try {
      streams = (JSON.parse(output) as { streams?: ProbeStream[] }).streams ?? [];
    } catch (error) {
      throw new FFmpegError(`FFprobe output not parseable for ${source}`, String(error));
    }

    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    const durationStr = video?.duration ?? audio?.duration;

    return {
      duration: durationStr ? parseFloat(durationStr) : null,
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      sampleRate: audio?.sample_rate ? parseInt(audio.sample_rate, 10) : null,
    };
  };
}

export default FFmpegLeclapAdapter;
