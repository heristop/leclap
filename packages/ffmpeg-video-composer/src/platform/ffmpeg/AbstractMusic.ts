import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractLogger from '../../platform/logging/AbstractLogger';

abstract class AbstractMusic {
  abstract process(
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<{ rc: number }>;
}

export default AbstractMusic;
