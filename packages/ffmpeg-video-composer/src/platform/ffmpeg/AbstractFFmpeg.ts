import type { FFMpegInfos } from '@/core/types';

export interface FSNode {
  name: string;
  isDir: boolean;
}

/**
 * Capability of adapters backed by an in-memory virtual filesystem (the WASM core). The director
 * stages input files into this FS before running a command and extracts the rendered output
 * afterwards. Native CLI adapters write straight to the real filesystem and don't implement it.
 *
 * Shared code branches on this via {@link hasVirtualFilesystem} rather than `instanceof
 * FFmpegWasmAdapter`, so the Hermes/React-Native bundle never statically imports the WASM adapter
 * (which drags in `@ffmpeg/ffmpeg`, whose worker uses an `import(coreURL)` Metro can't transform).
 */
export interface VirtualFilesystemFFmpeg {
  readonly usesVirtualFilesystem: true;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  readFile(name: string): Promise<Uint8Array>;
  deleteFile(name: string): Promise<void>;
  listDir(path: string): Promise<FSNode[]>;
}

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

/**
 * Narrows an adapter to one backed by a virtual filesystem. Checked via the explicit
 * `usesVirtualFilesystem` discriminant (not method presence) so a native adapter that merely
 * exposes file helpers isn't misclassified.
 */
export function hasVirtualFilesystem(adapter: AbstractFFmpeg): adapter is AbstractFFmpeg & VirtualFilesystemFFmpeg {
  return (adapter as Partial<VirtualFilesystemFFmpeg>).usesVirtualFilesystem === true;
}

export default AbstractFFmpeg;
