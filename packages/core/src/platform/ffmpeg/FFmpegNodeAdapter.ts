import { exec, type ExecException } from 'node:child_process';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import type { FFMpegInfos } from '../../core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '../../core/errors/FFmpegError';

const execAsync = promisify(exec);

interface FFProbeStream {
  codec_type: string;
  codec_name: string | null;
  duration: string;
  sample_rate?: string;
}

interface FFProbeData {
  streams: FFProbeStream[];
}

@injectable()
class FFmpegNodeAdapter extends AbstractFFmpeg {
  execute = async (command: string): Promise<{ rc: number }> => {
    try {
      await execAsync(`ffmpeg ${command}`);

      return { rc: 0 };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };

      throw new FFmpegError('FFmpeg command failed', execError.stderr);
    }
  };

  getInfos = async (source: string): Promise<FFMpegInfos> => {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${source}"`);

      const info: FFProbeData = JSON.parse(stdout);

      const videoStream = info.streams.find((s) => s.codec_type === 'video');
      const audioStream = info.streams.find((s) => s.codec_type === 'audio');

      return {
        duration: videoStream ? parseFloat(videoStream.duration) : null,
        videoCodec: videoStream?.codec_name ?? null,
        audioCodec: audioStream?.codec_name ?? null,
        sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : null,
      };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };

      throw new FFmpegError(`FFprobe analysis failed for ${source}`, execError.stderr);
    }
  };
}

export default FFmpegNodeAdapter;
