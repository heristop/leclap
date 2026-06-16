import { container, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractFFmpeg from './AbstractFFmpeg';
import type AbstractMusic from './AbstractMusic';

interface ProcessResult {
  rc: number;
}

// Log the error with a typed message when it's an Error — keeps `process`'s catch under the statement cap.
function logMusicError(logger: AbstractLogger, error: unknown): void {
  if (!(error instanceof Error)) {
    logger.error('[MusicFFmpegAdapter] Unknown error occurred');

    return;
  }

  logger.error(`[MusicFFmpegAdapter] Error: ${error.message}`);
}

/**
 * Platform-neutral music looper: drives whatever `ffmpegAdapter` is registered (the native engine on
 * device). Same logic as MusicWasmAdapter, but loops to an aac/m4a file — the on-device LGPL engine
 * builds the mp4/mov muxers + aac encoder, not the mp3 muxer the WASM variant's `-c copy` relied on.
 */
@injectable()
class MusicFFmpegAdapter implements AbstractMusic {
  process = async (
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      const ffmpeg = container.resolve<AbstractFFmpeg>('ffmpegAdapter');
      const musicLength = (await ffmpeg.getInfos(musicPath)).duration ?? 0;
      logger.info(`[MusicFFmpegAdapter] Duration: ${musicLength} / ${totalLength}`);

      if (musicLength <= 0 || musicLength >= totalLength) {
        return { rc: 0 };
      }

      const buildDir = filesystemAdapter.getBuildDir() ?? '/tmp/build';
      const loopPath = `${buildDir}/loop_music.m4a`;
      const command = ` -y -stream_loop -1 -i ${musicPath} -t ${totalLength} -c:a aac -b:a 192k ${loopPath} `;
      logger.debug(`[MusicFFmpegAdapter][Command] ffmpeg ${command}`);

      const result = await ffmpeg.execute(command);

      if (result.rc !== 0) {
        throw new Error('Failed to loop music on device');
      }

      await filesystemAdapter.move(loopPath, musicPath);
      logger.info('[MusicFFmpegAdapter][Loop] completed');

      return { rc: 0 };
    } catch (error: unknown) {
      logMusicError(logger, error);

      throw error;
    }
  };
}

export default MusicFFmpegAdapter;
