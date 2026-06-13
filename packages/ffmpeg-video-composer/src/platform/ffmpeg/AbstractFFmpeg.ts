import type { FFMpegInfos } from '@/core/types';

abstract class AbstractFFmpeg {
  /**
   * Optional per-exec progress listener (0..1). When set, adapters that receive
   * fine-grained progress from FFmpeg (e.g. the WASM core) forward it here so the
   * director can surface continuous progress to the UI. Cleared between segments.
   */
  progressListener?: (fraction: number) => void;

  /**
   * Expected output duration (seconds) of the command about to run, set by the director alongside
   * `progressListener`. Adapters that read raw elapsed time from FFmpeg (e.g. the on-device CLI's
   * `-progress` output) divide by this to produce the 0..1 fraction. Cleared between segments.
   */
  expectedDurationSeconds?: number;

  abstract execute(command: string): Promise<{ rc: number }>;

  abstract getInfos(source: string): Promise<FFMpegInfos>;
}

export default AbstractFFmpeg;
