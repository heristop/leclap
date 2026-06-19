import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type { FFMpegInfos, LogParams, ProjectConfig, Section } from '@/core/types';
import { assertSafeArgToken, assertSafeSegmentName } from '../core/argGuard';

// Everything TemplateDirector needs to find a section's clip and read its media info. Passed in rather
// than reaching back into the director so this stays a pure, testable unit.
export interface SectionInfosDeps {
  config: ProjectConfig;
  ffmpegAdapter: AbstractFFmpeg;
  filesystemAdapter: AbstractFilesystem;
  logger: AbstractLogger;
}

// The user-recorded clip for a project_video section, if one was supplied and exists on disk.
const resolveUserVideoSource = async (deps: SectionInfosDeps, section: Section): Promise<string | undefined> => {
  const userPath = deps.config.userVideoPaths?.[section.name];

  if (section.type !== 'project_video' || !userPath) {
    return undefined;
  }

  try {
    await deps.filesystemAdapter.stat(userPath);
    deps.logger.info(`[fetchSectionInfos] Using section-specific video for ${section.name}: ${userPath}`);

    return userPath;
  } catch (error) {
    const logParams: LogParams = error instanceof Error ? { message: error.message, stack: error.stack } : {};
    deps.logger.error(`[fetchSectionInfos] Error accessing section-specific video: ${userPath}`, logParams);

    return undefined;
  }
};

// Probe the clip, tolerating two failures by falling back to the section's declared `options.duration`:
// a probe that throws (a clip the WASM build can't demux — some browser/MediaRecorder MP4s) and a clip
// that advertises no duration. The render still runs; the section is trimmed to that length anyway.
// With no declared duration there's nothing to fall back to, so the original error propagates.
const probeWithFallback = async (deps: SectionInfosDeps, section: Section, source: string): Promise<FFMpegInfos> => {
  const declared = typeof section.options?.duration === 'number' ? section.options.duration : 0;

  let info: FFMpegInfos;

  try {
    info = await deps.ffmpegAdapter.getInfos(source);
  } catch (error) {
    if (declared <= 0) throw error;

    deps.logger.warn(`[fetchSectionInfos] Probe failed for ${section.name}; using declared duration ${declared}s`, {
      error: error instanceof Error ? error.message : String(error),
    });

    return { duration: declared, videoCodec: null, audioCodec: null, sampleRate: null };
  }

  if (info.duration !== null) return info;

  if (declared <= 0) throw new Error(`Duration not found for ${section.name}`);

  deps.logger.info(`[fetchSectionInfos] No probed duration for ${section.name}; using declared ${declared}s`);

  return { ...info, duration: declared };
};

// Resolve a section's clip source (user recording, else the assets-dir fallback) and read its media
// info, falling back to the declared duration when the probe can't.
export const fetchSectionInfos = async (deps: SectionInfosDeps, section: Section): Promise<FFMpegInfos> => {
  const userPaths = deps.config.userVideoPaths;
  deps.logger.info(`[fetchSectionInfos] Processing section ${section.name} (${section.type})`, {
    userVideoPaths: userPaths ? Object.keys(userPaths).join(', ') : 'none',
  });

  const resolvedSource = await resolveUserVideoSource(deps, section);
  // Guard the section name in the assets-dir fallback (prevents `../` traversal into a probed file)
  // and reject whitespace/NUL in the probed source token, mirroring the `-i` source guard.
  const source = assertSafeArgToken(
    resolvedSource ?? `${deps.filesystemAdapter.getAssetsDir('videos')}/${assertSafeSegmentName(section.name)}.mp4`,
    'source'
  );

  if (!resolvedSource) {
    deps.logger.info(`[fetchSectionInfos] Using default assets path for section ${section.name}: ${source}`);
  }

  return probeWithFallback(deps, section, source);
};
