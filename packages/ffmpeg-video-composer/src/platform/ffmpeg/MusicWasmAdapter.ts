import { container, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractFFmpeg from './AbstractFFmpeg';
import type AbstractMusic from './AbstractMusic';

interface ProcessResult {
  rc: number;
  musicPath: string;
}

@injectable()
class MusicWasmAdapter implements AbstractMusic {
  /**
   * Loop the background track to cover the full video length, in the browser.
   * Probes duration via the WASM FFmpeg adapter; if the track is shorter than the
   * video, `-stream_loop`s it into the build dir and returns that copy's path.
   */
  process = async (
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      const ffmpeg = container.resolve<AbstractFFmpeg>('ffmpegAdapter');
      const musicLength = (await ffmpeg.getInfos(musicPath)).duration ?? 0;
      logger.info(`[MusicWasmAdapter] Duration: ${musicLength} / ${totalLength}`);

      if (musicLength <= 0 || musicLength >= totalLength) {
        return { rc: 0, musicPath };
      }

      const loopPath = await this.loopToLength(ffmpeg, logger, filesystemAdapter, totalLength, musicPath);

      return { rc: 0, musicPath: loopPath };
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        logger.error('[MusicWasmAdapter] Unknown error occurred');

        throw error;
      }

      logger.error(`[MusicWasmAdapter] Error: ${error.message}`);

      throw error;
    }
  };

  private async loopToLength(
    ffmpeg: AbstractFFmpeg,
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<string> {
    const buildDir = filesystemAdapter.getBuildDir() ?? '/tmp/build';
    const loopPath = `${buildDir}/loop_music.mp3`;
    const command = ` -y -stream_loop -1 -i ${musicPath} -t ${totalLength} -c copy ${loopPath} `;
    logger.debug(`[MusicWasmAdapter][Command] ffmpeg ${command}`);

    const result = await ffmpeg.execute(command);

    if (result.rc !== 0) {
      throw new Error('Failed to loop music in browser');
    }

    logger.info('[MusicWasmAdapter][Loop] ffmpeg process completed');

    return loopPath;
  }
}

export default MusicWasmAdapter;
