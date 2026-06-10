import { requireNativeModule } from 'expo';

/** Result of an ffmpeg run: exit code + captured stderr (ffmpeg's log — the reason on failure). */
export interface RunResult {
  code: number;
  log: string;
}

/** Result of an ffprobe invocation: exit code + captured stdout (JSON when so requested). */
export interface ProbeResult {
  code: number;
  output: string;
}

interface LeclapFfmpegNativeModule {
  version(): string;
  run(args: string[]): Promise<RunResult>;
  probe(args: string[]): Promise<ProbeResult>;
}

const Native = requireNativeModule<LeclapFfmpegNativeModule>('LeclapFfmpeg');

/** FFmpeg build version the engine links against (e.g. "n8.0"). Also used as a presence probe. */
export function version(): string {
  return Native.version();
}

/** Run an ffmpeg command (args WITHOUT the program name). Resolves with the exit code + stderr log. */
export function run(args: string[]): Promise<RunResult> {
  return Native.run(args);
}

/** Run an ffprobe command (args WITHOUT the program name); resolves with code + captured stdout. */
export function probe(args: string[]): Promise<ProbeResult> {
  return Native.probe(args);
}
