import type { CompileRecordedVideos } from '@/src/services/api';
import type { TemplateDescriptor, MediaChoices } from '@/src/types';
import { CoreCompilationService } from './CoreCompilationService';
import type { CompileProgress } from './CompileService';
import { describeOnDeviceCapability } from './capability';
import { isFFmpegAvailable } from './ffmpegAvailability';

export interface CompileVideoResult {
  success: boolean;
  outputUri?: string;
  error?: string;
}

export interface CompileVideoOptions {
  /** Set a font path to enable on-device drawtext once the engine supports it (currently unused). */
  fontPath?: string;
  /** Reserved for future on-device media selection; the local engine uses the template's own media. */
  mediaChoices?: MediaChoices;
  /** Live progress (0..1 ratio + stage label) forwarded from the engine to the progress UI. */
  onProgress?: (progress: CompileProgress) => void;
}

/**
 * Compile a template on-device. The app is fully local — there is no server fallback. The reused core
 * renders everything the descriptor expresses (incl. animation `maps[]`), so the capability gate is
 * permissive; a genuine engine failure surfaces as a real error from `CoreCompilationService` rather
 * than a pre-emptive refusal. Returns the same `{ success, outputUri, error }` shape callers consume.
 */
export async function compileOnDevice(
  templateDescriptor: unknown,
  recordedVideos: CompileRecordedVideos,
  options: CompileVideoOptions = {}
): Promise<CompileVideoResult> {
  const descriptor = (templateDescriptor ?? {}) as TemplateDescriptor;

  if (!isFFmpegAvailable()) {
    return { success: false, error: 'The on-device video engine is not available in this build.' };
  }

  const capability = describeOnDeviceCapability(descriptor, recordedVideos);

  if (!capability.capable) {
    return { success: false, error: `This template can't be compiled on this device (${capability.reason}).` };
  }

  return new CoreCompilationService().compile(
    { descriptor, clips: recordedVideos },
    { onProgress: options.onProgress }
  );
}
