import type { TemplateDescriptor } from '@/src/types';
import type { CompileRecordedVideos } from '@/src/services/api';

/**
 * The single seam through which the app turns a template + recorded clips into a finished
 * video. A `StubCompileService` lets the Builder wizard be built and tested end-to-end in a
 * simulator; `CoreCompilationService` drives the real on-device engine (the native
 * `leclap-ffmpeg` module) behind the same interface. No server involved.
 */

/** Clips (recorded or picked) keyed by section name, e.g. `video_1`. Same shape the server path used. */
export type { CompileRecordedVideos };

export interface CompileInput {
  descriptor: TemplateDescriptor;
  clips: CompileRecordedVideos;
}

export interface CompileProgress {
  /** Best-effort overall progress in the range 0..1. */
  ratio: number;
  /** Human-readable stage label for the progress UI. */
  stage: string;
}

export interface CompileResult {
  success: boolean;
  /** `file://` URI of the finished video on success. */
  outputUri?: string;
  error?: string;
}

export interface CompileOptions {
  onProgress?: (progress: CompileProgress) => void;
  /** Abort an in-flight compilation; implementations resolve to a cancelled result. */
  signal?: AbortSignal;
}

export interface CompileService {
  compile(input: CompileInput, options?: CompileOptions): Promise<CompileResult>;
}
