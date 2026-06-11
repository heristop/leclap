import { compileVideo, type CompileRecordedVideos } from '@/src/services/api';
import type { TemplateDescriptor, MediaChoices } from '@/src/types';
import { resolveCompileMode } from '@/src/stores/useSettingsStore';
import { CoreCompilationService } from './CoreCompilationService';
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
 * Compile router driven by the user's Local/Server choice (Settings → `compileMode`, default Local).
 * This is an explicit switch, NOT an automatic fallback: in Local mode the job runs on-device only —
 * if the engine is missing or the template needs something on-device can't do (animation `maps`), it
 * returns a clear error telling the user to switch to Server, rather than silently using the network.
 * In Server mode it always uses the compile server. (`EXPO_PUBLIC_ENABLE_SERVER=false` forces Local
 * and hides the option entirely.) Returns the same `{ success, outputUri, error }` shape as
 * `compileVideo`, plus which `engine` ran.
 */
export async function compileHybrid(
  templateDescriptor: unknown,
  recordedVideos: CompileRecordedVideos,
  options: HybridOptions = {}
): Promise<HybridResult> {
  const mode = resolveCompileMode();

  if (mode === 'server') {
    console.log('[compileHybrid] → server (selected in Settings)');
    const server = await compileVideo(templateDescriptor, recordedVideos, options.mediaChoices);

    return { ...server, engine: 'server' };
  }

  // Local mode (default): on-device only, no network fallback.
  const descriptor = (templateDescriptor ?? {}) as TemplateDescriptor;

  if (!isFFmpegAvailable()) {
    return {
      success: false,
      engine: 'on-device',
      error: 'The on-device engine is not available in this build. Switch to Server in Settings.',
    };
  }

  const capability = describeOnDeviceCapability(descriptor, recordedVideos);

  if (!capability.capable) {
    return {
      success: false,
      engine: 'on-device',
      error: `This scenario can't be made on-device (${capability.reason}). Switch to Server in Settings.`,
    };
  }

  console.log('[compileHybrid] → on-device (Local mode)');
  const service = new CoreCompilationService();
  const result = await service.compile({ descriptor, clips: recordedVideos });

  return { ...result, engine: 'on-device' };
}
