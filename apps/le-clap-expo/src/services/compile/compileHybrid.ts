import { compileVideo, type CompileRecordedVideos } from '@/src/services/api';
import type { TemplateDescriptor, MediaChoices } from '@/src/types';
import { OnDeviceCompileService } from './OnDeviceCompileService';
import { describeOnDeviceCapability } from './capability';
import { isFFmpegAvailable } from './ffmpegAvailability';

export type CompileEngine = 'on-device' | 'server';

export interface HybridResult {
  success: boolean;
  outputUri?: string;
  error?: string;
  /** Which engine produced (or attempted) the result — useful for UI/telemetry. */
  engine: CompileEngine;
}

export interface HybridOptions {
  /** Set a font path to enable on-device drawtext once the engine supports it (currently unused by the stub). */
  fontPath?: string;
  /** User-chosen music and background to send to the server (on-device engine ignores these for now). */
  mediaChoices?: MediaChoices;
}

/**
 * Hybrid compile router. Runs on-device only when (a) the native module is present in this build
 * and (b) the job is something the on-device engine can produce correctly (see capability.ts) —
 * otherwise it falls back to the server. On-device failures also fall back to the server, so a
 * job never gets stuck because the device path errored. Returns the same `{ success, outputUri,
 * error }` shape as `compileVideo`, plus which `engine` was used.
 *
 * `mediaChoices` (music + background) are forwarded to the server path; the on-device engine
 * does not yet consume them.
 */
export async function compileHybrid(
  templateDescriptor: unknown,
  recordedVideos: CompileRecordedVideos,
  options: HybridOptions = {}
): Promise<HybridResult> {
  const descriptor = (templateDescriptor ?? {}) as TemplateDescriptor;
  const capability = describeOnDeviceCapability(descriptor, recordedVideos);

  if (isFFmpegAvailable() && capability.capable) {
    try {
      const service = new OnDeviceCompileService({ fontPath: options.fontPath });
      const result = await service.compile({ descriptor, clips: recordedVideos });

      if (result.success) {
        return { ...result, engine: 'on-device' };
      }

      console.warn(`[compileHybrid] on-device compile failed, falling back to server: ${result.error}`);
    } catch (error) {
      console.warn('[compileHybrid] on-device compile threw, falling back to server:', error);
    }
  }

  const server = await compileVideo(templateDescriptor, recordedVideos, options.mediaChoices);

  return { ...server, engine: 'server' };
}
