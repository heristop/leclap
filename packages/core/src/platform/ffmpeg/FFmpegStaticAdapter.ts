import { exec, type ExecException } from 'node:child_process';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import type { FFMpegInfos } from '@/core/types';
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
class FFmpegStaticAdapter extends AbstractFFmpeg {
  private ffmpegPath: string | null = null;
  private ffprobePath: string | null = null;

  constructor() {
    super();
    this.initializePaths();
  }

  private initializePaths(): void {
    try {
      // Try to load ffmpeg-static
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegStatic = require('ffmpeg-static');
      this.ffmpegPath = ffmpegStatic;

      // Try to load ffprobe-static (usually comes with ffmpeg-static)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ffprobeStatic = require('ffprobe-static');
        this.ffprobePath = ffprobeStatic.path;
      } catch {
        // If ffprobe-static is not available, try to use ffprobe from the same directory as ffmpeg
        if (this.ffmpegPath) {
          this.ffprobePath = this.ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
        }
      }
    } catch {
      throw new Error('ffmpeg-static package not found. Please install it as an optional dependency.');
    }
  }

  /**
   * Execute a FFmpeg command using the static binary
   * @param command - FFmpeg command to execute
   * @returns Promise with process result
   * @throws Error if FFmpeg command fails
   */
  execute = async (command: string): Promise<{ rc: number }> => {
    if (!this.ffmpegPath) {
      throw new FFmpegError('FFmpeg static binary not available');
    }

    try {
      await execAsync(`"${this.ffmpegPath}" ${command}`);
      return { rc: 0 };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };
      throw new FFmpegError('FFmpeg command failed (static)', execError.stderr);
    }
  };

  /**
   * Get media file information using FFprobe static binary
   * @param source - Path to the media file
   * @returns Promise with media file information
   * @throws Error if FFprobe analysis fails
   */
  getInfos = async (source: string): Promise<FFMpegInfos> => {
    if (!this.ffprobePath) {
      throw new FFmpegError('FFprobe static binary not available');
    }

    try {
      console.log(`[FFmpegStaticAdapter] Getting info for file: ${source}`);

      // Execute ffprobe with JSON output format
      const { stdout } = await execAsync(`"${this.ffprobePath}" -v quiet -print_format json -show_streams "${source}"`);

      const info: FFProbeData = JSON.parse(stdout);

      const videoStream = info.streams.find((s) => s.codec_type === 'video');
      const audioStream = info.streams.find((s) => s.codec_type === 'audio');

      console.log(`[FFmpegStaticAdapter] File info:`, {
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
      throw new FFmpegError(`FFprobe analysis failed for ${source} (static)`, execError.stderr);
    }
  };
}

export default FFmpegStaticAdapter;
