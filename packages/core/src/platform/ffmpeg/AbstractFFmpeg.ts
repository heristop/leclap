import type { FFMpegInfos } from '@/core/types';

abstract class AbstractFFmpeg {
  /**
   * Optional per-exec progress listener (0..1). When set, adapters that receive
   * fine-grained progress from FFmpeg (e.g. the WASM core) forward it here so the
   * director can surface continuous progress to the UI. Cleared between segments.
   */
  progressListener?: (fraction: number) => void;

  abstract execute(command: string): Promise<{ rc: number }>;

  abstract getInfos(source: string): Promise<FFMpegInfos>;
}

export default AbstractFFmpeg;
