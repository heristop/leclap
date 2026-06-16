import { injectable } from 'tsyringe';
import fs from 'node:fs/promises';
import { execFile, type ExecException } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractMusic from './AbstractMusic';

const execFileAsync = promisify(execFile);

interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ProcessResult {
  rc: number;
}

@injectable()
class MusicNodeAdapter implements AbstractMusic {
  /**
   * Get the duration of a media file using ffprobe
   * @param filePath - Path to the media file
   * @returns Promise with the duration in seconds
   * @throws Error if ffprobe fails to get the duration
   */
  private async getMediaDuration(filePath: string): Promise<number> {
    try {
      const { stdout }: ExecResult = await execFileAsync('ffprobe', [
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
   * Loop the music file to match the required total length
   * @param logger - Logger instance
   * @param musicPath - Path to the music file
   * @param musicLength - Duration of the music file in seconds
   * @param totalLength - Required total length in seconds
   * @param buildDir - Directory to store the looped file
   */
  private async loopMusic(
    logger: AbstractLogger,
    musicPath: string,
    musicLength: number,
    totalLength: number,
    buildDir: string
  ): Promise<void> {
    const loop = path.join(buildDir, 'loop_music.mp4');

    let input = `concat:${musicPath}`;
    let repetitions = 1;

    while (repetitions * musicLength < totalLength) {
      input += `|${musicPath}`;
      repetitions++;
    }

    const args = ['-y', '-i', input, '-acodec', 'copy', loop];
    const command = `ffmpeg ${args.join(' ')}`;
    logger.debug(`[Music][Command] ${command}`);

    try {
      await execFileAsync('ffmpeg', args);

      await fs.unlink(musicPath);
      await fs.rename(loop, musicPath);

      logger.info(`[Music][Loop] ffmpeg process completed`);
    } catch (error: unknown) {
      const execError = error as ExecException;

      throw new Error(`Failed command: ${command}\nError: ${execError.message}`);
    }
  }

  /**
   * Process the music file, looping it if necessary to match the total length
   * @param logger - Logger instance
   * @param filesystemAdapter - Filesystem adapter instance
   * @param totalLength - Required total length in seconds
   * @param musicPath - Path to the music file
   * @returns Promise with process result
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

        await this.loopMusic(logger, musicPath, musicLength, totalLength, buildDir);
      }

      return { rc: 0 };
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
