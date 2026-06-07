import { injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractMusic from './AbstractMusic';

interface ProcessResult {
  rc: number;
}

@injectable()
class MusicWasmAdapter implements AbstractMusic {
  /**
   * Note: Looping functionality not yet implemented in browser
   */
  process = async (
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<ProcessResult> => {
    try {
      logger.info(`[MusicWasmAdapter] Processing music file: ${musicPath}`);
      logger.info(`[MusicWasmAdapter] Target length: ${totalLength} seconds`);

      // Full music processing for browser is not yet implemented:
      // 1. Load the music file from IndexedDB
      // 2. Use FFmpeg WASM to get duration
      // 3. Use FFmpeg WASM to loop if necessary
      // 4. Store the processed file back to IndexedDB

      logger.info(`[MusicWasmAdapter] Music processing completed (placeholder)`);

      return { rc: 0 };
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        logger.error('[MusicWasmAdapter] Unknown error occurred');

        throw error;
      }

      logger.error(`[MusicWasmAdapter] Error: ${error.message}`);

      throw error;
    }
  };
}

export default MusicWasmAdapter;
