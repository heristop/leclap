import { exec, ExecException } from 'node:child_process';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '@/core/errors/FFmpegError';

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
  /**
   * Execute a FFmpeg command
   * @param command - FFmpeg command to execute
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    try {
      await execAsync(`ffmpeg ${command}`);
      return { rc: 0 };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };
      throw new FFmpegError('FFmpeg command failed', execError.stderr);
    }
  };

  /**
   * Get media file information using FFprobe
   * @param source - Path to the media file
   * @returns Promise with media file information
   * @throws Error if FFprobe analysis fails
   */
  getInfos = async (source: string): Promise<FFMpegInfos> => {
    try {
      console.log(`[FFmpegNodeAdapter] Getting info for file: ${source}`);

      // Execute ffprobe with JSON output format
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${source}"`);

      const info: FFProbeData = JSON.parse(stdout);

      const videoStream = info.streams.find((s) => s.codec_type === 'video');
      const audioStream = info.streams.find((s) => s.codec_type === 'audio');

      console.log(`[FFmpegNodeAdapter] File info:`, {
        videoFound: !!videoStream,
        audioFound: !!audioStream,
        duration: videoStream ? parseFloat(videoStream.duration) : null,
        videoCodec: videoStream?.codec_name || null,
      });

      return {
        duration: videoStream ? parseFloat(videoStream.duration) : null,
        videoCodec: videoStream?.codec_name || null,
        audioCodec: audioStream?.codec_name || null,
        sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : null,
      };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };
      throw new FFmpegError(`FFprobe analysis failed for ${source}`, execError.stderr);
    }
  };
}

export default FFmpegNodeAdapter;
