import { exec, type ExecException } from 'node:child_process';
import { createRequire } from 'node:module';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import type { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg from './AbstractFFmpeg';
import { FFmpegError } from '../../core/errors/FFmpegError';

const requireModule = createRequire(import.meta.url);

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
      const ffmpegStatic = requireModule('ffmpeg-static') as string | null;
      this.ffmpegPath = ffmpegStatic;

      try {
        const ffprobeStatic = requireModule('ffprobe-static') as { path: string };
        this.ffprobePath = ffprobeStatic.path;
      } catch {
        if (this.ffmpegPath) {
          this.ffprobePath = this.ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
        }
      }
    } catch {
      throw new Error('ffmpeg-static package not found. Please install it as an optional dependency.');
    }
  }

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

  getInfos = async (source: string): Promise<FFMpegInfos> => {
    if (!this.ffprobePath) {
      throw new FFmpegError('FFprobe static binary not available');
    }

    try {
      const { stdout } = await execAsync(`"${this.ffprobePath}" -v quiet -print_format json -show_streams "${source}"`);

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

      throw new FFmpegError(`FFprobe analysis failed for ${source} (static)`, execError.stderr);
    }
  };
}

export default FFmpegStaticAdapter;
