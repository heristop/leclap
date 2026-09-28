import { container, injectable } from 'tsyringe';
import { execFile, type ExecException } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import { FFmpegError } from '../../core/errors/FFmpegError';
import type { default as AbstractFFmpeg, FFmpegBinaries } from './AbstractFFmpeg';
import type AbstractMusic from './AbstractMusic';
import { FFPROBE_MISSING_MESSAGE } from './resolve-ffprobe';

const execFileAsync = promisify(execFile);

// For a selected adapter that runs FFmpeg in-process and spawns nothing: the PATH lookup this adapter always did.
const PATH_BINARIES: FFmpegBinaries = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' };

// The binaries of the FFmpeg adapter the bridge selected. Spawning `ffmpeg`/`ffprobe` by name used to miss
// ffmpeg-static's, which aren't on PATH, so music failed only after every segment had rendered.
function selectedBinaries(): FFmpegBinaries {
  return container.resolve<AbstractFFmpeg>('ffmpegAdapter').binaries ?? PATH_BINARIES;
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ProcessResult {
  rc: number;
  musicPath: string;
}

@injectable()
class MusicNodeAdapter implements AbstractMusic {
  /**
   * Get the duration of a media file using the selected adapter's ffprobe
   * @param filePath - Path to the media file
   * @returns Promise with the duration in seconds
   * @throws Error if there is no ffprobe, or it fails to get the duration
   */
  private async getMediaDuration(filePath: string): Promise<number> {
    const { ffprobe } = selectedBinaries();

    if (ffprobe === null) {
      throw new FFmpegError(FFPROBE_MISSING_MESSAGE);
    }

    try {
      const { stdout }: ExecResult = await execFileAsync(ffprobe, [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const duration = parseFloat(stdout.trim());

      if (isNaN(duration)) {
        throw new Error('Invalid duration value returned by ffprobe');
      }

      return duration;
    } catch (error: unknown) {
      const execError = error as ExecException;

      throw new Error(`Failed to get media duration: ${execError.message}`);
    }
  }

  /**
   * Loop the music file to match the required total length, into a copy in the build directory
   * @param logger - Logger instance
   * @param musicPath - Path to the music file
   * @param musicLength - Duration of the music file in seconds
   * @param totalLength - Required total length in seconds
   * @param buildDir - Directory to store the looped file
   * @returns Path of the looped copy
   */
  private async loopMusic(
    logger: AbstractLogger,
    musicPath: string,
    musicLength: number,
    totalLength: number,
    buildDir: string
  ): Promise<string> {
    const loop = path.join(buildDir, 'loop_music.mp4');

    let input = `concat:${musicPath}`;
    let repetitions = 1;

    while (repetitions * musicLength < totalLength) {
      input += `|${musicPath}`;
      repetitions++;
    }

    const { ffmpeg } = selectedBinaries();
    const args = ['-y', '-i', input, '-acodec', 'copy', loop];
    const command = `${ffmpeg} ${args.join(' ')}`;
    logger.debug(`[Music][Command] ${command}`);

    try {
      await execFileAsync(ffmpeg, args);

      logger.info(`[Music][Loop] ffmpeg process completed`);
    } catch (error: unknown) {
      const execError = error as ExecException;

      throw new Error(`Failed command: ${command}\nError: ${execError.message}`);
    }

    return loop;
  }

  /**
   * Process the music file, looping it if necessary to match the total length
   * @param logger - Logger instance
   * @param filesystemAdapter - Filesystem adapter instance
   * @param totalLength - Required total length in seconds
   * @param musicPath - Path to the music file, never written
   * @returns Promise with process result, whose musicPath is the track to mix: musicPath itself or its looped copy
   * @throws Error if ffmpeg processing fails
   */
  process = async (
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength = 0,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      const musicLength = await this.getMediaDuration(musicPath);
      logger.info(`[Music] Duration: ${musicLength} / ${totalLength}`);

      if (musicLength < totalLength) {
        const buildDir = filesystemAdapter.getBuildDir();

        if (buildDir === undefined) {
          throw new Error('Build directory is not set');
        }

        const loopPath = await this.loopMusic(logger, musicPath, musicLength, totalLength, buildDir);

        return { rc: 0, musicPath: loopPath };
      }

      return { rc: 0, musicPath };
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        logger.error('[Music] Unknown error occurred');

        throw error;
      }

      logger.error(`[Music] Error: ${error.message}`);

      throw error;
    }
  };
}

export default MusicNodeAdapter;
