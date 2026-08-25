import { createProgressReporter } from '../worker/progress-reporter.js';

/** The shape Remotion's `renderMedia` hands to `onProgress`. Only `progress` (0–1) is used. */
export interface RemotionProgress {
  progress: number;
}

/**
 * A Remotion-shaped `onProgress` that mirrors what `compose_video` writes for a compile.
 *
 * `render_remotion_clip` renders in-process — there is no worker, so unlike the compile path it has
 * to apply `createProgressReporter` itself. Without the throttle Remotion's per-frame callback would
 * flood stderr; without any handler at all a long bundle-then-render is completely silent and reads
 * as hung to the calling agent.
 *
 * stderr, never stdout: stdout is the MCP JSON-RPC framing channel.
 */
export function createClipProgressHandler(
  renderId: string,
  log: (line: string) => void = console.error
): (update: RemotionProgress) => void {
  const report = createProgressReporter(({ fraction }) => {
    log(`[render_remotion_clip] render ${renderId} ${Math.round(fraction * 100)}%`);
  });

  return (update) => {
    report(update.progress);
  };
}
