// FFmpeg 8 logs the cause of a failure first, then a `Task finished` / `Terminating thread` pair for each
// stage it tears down: 9 to 12 lines at `-loglevel error` for a filter that fails to configure. Twenty
// keeps the cause, and only cuts a run that logs an error per frame, such as one decoding a corrupt input.
const TAIL_LINES = 20;

/**
 * The part of a failed command's stderr worth reporting: its last non-empty lines. The Node CLI adapters
 * run ffmpeg at `-loglevel error`, so what they capture is the failure itself.
 */
export function tailStderr(stderr: string | undefined): string {
  return (stderr ?? '').split('\n').filter(Boolean).slice(-TAIL_LINES).join('\n');
}
