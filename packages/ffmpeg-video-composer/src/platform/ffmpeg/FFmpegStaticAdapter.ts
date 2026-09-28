import { execFile, type ExecException } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { injectable } from 'tsyringe';
import { promisify } from 'node:util';
import type { FFMpegInfos } from '@/core/types';
import AbstractFFmpeg, { type FFmpegBinaries } from './AbstractFFmpeg';
import { FFmpegError } from '../../core/errors/FFmpegError';
import { parseCommand } from './parse-command';
import { FFPROBE_MISSING_MESSAGE, resolveStaticFfprobe } from './resolve-ffprobe';
import { tailStderr } from './tail-stderr';

const requireModule = createRequire(import.meta.url);

const execFileAsync = promisify(execFile);

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

  // Each execute() spawns an independent ffmpeg-static process, so renders can overlap.
  override get supportsConcurrentExecute(): boolean {
    return true;
  }

  override get probeUnavailableReason(): string | null {
    return this.ffprobePath ? null : FFPROBE_MISSING_MESSAGE;
  }

  override get binaries(): FFmpegBinaries | null {
    return this.ffmpegPath ? { ffmpeg: this.ffmpegPath, ffprobe: this.ffprobePath } : null;
  }

  // A missing ffprobe is not fatal here: templates that never probe (cuts-only cards, no music, no
  // overlays, no clips) still render, so the gap is reported at the first probe or by the director.
  private initializePaths(): void {
    try {
      this.ffmpegPath = requireModule('ffmpeg-static') as string | null;
    } catch {
      throw new Error('ffmpeg-static package not found. Please install it as an optional dependency.');
    }

    this.ffprobePath = resolveStaticFfprobe(this.ffmpegPath, { requireModule, exists: existsSync });
  }

  execute = async (command: string): Promise<{ rc: number }> => {
    if (!this.ffmpegPath) {
      throw new FFmpegError('FFmpeg static binary not available');
    }

    try {
      // Errors only, as in FFmpegNodeAdapter: the default level buries the reason under the banner and
      // the stream dumps.
      await execFileAsync(this.ffmpegPath, ['-loglevel', 'error', ...parseCommand(command)]);

      return { rc: 0 };
    } catch (error) {
      const execError = error as ExecException & { stderr: string };

      throw new FFmpegError('FFmpeg command failed (static)', tailStderr(execError.stderr));
    }
  };

  getInfos = async (source: string): Promise<FFMpegInfos> => {
    if (!this.ffprobePath) {
      throw new FFmpegError(FFPROBE_MISSING_MESSAGE);
    }

    try {
      const { stdout } = await execFileAsync(this.ffprobePath, [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_streams',
        source,
      ]);

      const info: FFProbeData = JSON.parse(stdout);

      const videoStream = info.streams.find((s) => s.codec_type === 'video');
      const audioStream = info.streams.find((s) => s.codec_type === 'audio');
      // WebM/MKV streams often carry no duration (or 'N/A'); parseFloat would yield NaN, which
      // slips past `!== null` checks and defeats the declared-duration fallback downstream.
      const parsedDuration = videoStream ? parseFloat(videoStream.duration) : NaN;

      return {
        duration: Number.isFinite(parsedDuration) ? parsedDuration : null,
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
