import { injectable } from 'tsyringe';
import fs from 'fs/promises';
import { exec, ExecException } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import AbstractLogger from '../../platform/logging/AbstractLogger';
import AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import AbstractMusic from './AbstractMusic';

const execAsync = promisify(exec);

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
      const { stdout }: ExecResult = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
      );
      const duration: number = parseFloat(stdout.trim());

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
    totalLength: number = 0,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      const musicLength: number = await this.getMediaDuration(musicPath);
      logger.info(`[Music] Duration: ${musicLength} / ${totalLength}`);

      if (musicLength < totalLength) {
        const loop: string = path.join(filesystemAdapter.getBuildDir(), 'loop_music.mp4');

        // Create concatenation string for ffmpeg input
        let input: string = `concat:${musicPath}`;
        let repetitions: number = 1;

        while (repetitions * musicLength < totalLength) {
          input += `|${musicPath}`;
          repetitions++;
        }

        const command: string = `ffmpeg -y -i "${input}" -acodec copy "${loop}"`;
        logger.debug(`[Music][Command] ${command}`);

        try {
          await execAsync(command);

          // Replace original file with looped version
          await fs.unlink(musicPath);
          await fs.rename(loop, musicPath);

          logger.info(`[Music][Loop] ffmpeg process completed successfully`);
          return { rc: 0 };
        } catch (error: unknown) {
          const execError = error as ExecException;
          throw new Error(`Failed command: ${command}\nError: ${execError.message}`);
        }
      }

      return { rc: 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`[Music] Error: ${error.message}`);
      } else {
        logger.error('[Music] Unknown error occurred');
      }
      throw error;
    }
  };
}

export default MusicNodeAdapter;
