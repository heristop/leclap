/**
 * Progress ping sent from the render worker while a compile is in flight. `kind` is the
 * discriminator the runner uses to tell these apart from the single terminal result message —
 * which deliberately carries no `kind`, so the existing result contract is untouched.
 */
export interface ProgressMessage {
  kind: 'progress';
  fraction: number;
}

/**
 * Minimum advance before another ping is emitted. The engine calls `onProgress` per ffmpeg stats
 * line; at 2% granularity a render emits ~50 messages instead of several hundred, which keeps both
 * the IPC channel and the client's log readable.
 */
export const PROGRESS_STEP = 0.02;

/**
 * Wrap `send` in a monotonic throttle. The terminal 1 always gets through (a client that missed it
 * would show a render stuck at 98%), but only once.
 */
export function createProgressReporter(send: (message: ProgressMessage) => void): (fraction: number) => void {
  let last = -1;

  return (fraction: number): void => {
    const clamped = Math.min(1, Math.max(0, fraction));
    const isFinal = clamped >= 1 && last < 1;

    if (!isFinal && clamped - last < PROGRESS_STEP) {
      return;
    }

    last = clamped;
    send({ kind: 'progress', fraction: clamped });
  };
}
