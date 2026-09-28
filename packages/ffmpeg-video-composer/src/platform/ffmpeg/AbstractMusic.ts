import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type AbstractLogger from '../../platform/logging/AbstractLogger';

abstract class AbstractMusic {
  // Resolves the track to mix under `totalLength` seconds of video: `musicPath` itself when it already covers
  // them, else a looped copy written to the build dir. `musicPath` is never written — it can be the caller's
  // own media library, the package's bundled track, or a staged copy an app reuses across renders.
  abstract process(
    logger: AbstractLogger,
    filesystemAdapter: AbstractFilesystem,
    totalLength: number,
    musicPath: string
  ): Promise<{ rc: number; musicPath: string }>;
}

export default AbstractMusic;
