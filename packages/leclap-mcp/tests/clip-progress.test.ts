import { describe, expect, it } from 'vitest';
import { createClipProgressHandler } from '../src/tools/clip-progress.js';
import { PROGRESS_STEP } from '../src/worker/progress-reporter.js';

function collect(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = [];

  return { lines, log: (line) => lines.push(line) };
}

describe('createClipProgressHandler', () => {
  it('logs the tool name, the render id and a whole-percent figure', () => {
    const { lines, log } = collect();
    createClipProgressHandler('abc123', log)({ progress: 0.5 });

    expect(lines).toEqual(['[render_remotion_clip] render abc123 50%']);
  });

  // Remotion hands back an object, not a bare number — reading it as a fraction would log NaN%.
  it('reads the progress field out of Remotion update object', () => {
    const { lines, log } = collect();
    const onProgress = createClipProgressHandler('abc123', log);
    onProgress({ progress: 0.25, renderedFrames: 30, encodedFrames: 28 } as { progress: number });

    expect(lines[0]).toContain('25%');
  });

  it('throttles to the same step compose_video uses', () => {
    const { lines, log } = collect();
    const onProgress = createClipProgressHandler('abc123', log);
    onProgress({ progress: 0.5 });
    onProgress({ progress: 0.5 + PROGRESS_STEP / 2 });

    expect(lines).toHaveLength(1);
  });

  it('emits once the advance reaches the step', () => {
    const { lines, log } = collect();
    const onProgress = createClipProgressHandler('abc123', log);
    onProgress({ progress: 0.5 });
    onProgress({ progress: 0.5 + PROGRESS_STEP });

    expect(lines).toHaveLength(2);
  });

  // The field is forwarded unvalidated, so a Remotion build that renames it — or any callback fired
  // before the first frame — hands through `undefined`. `Math.min(1, Math.max(0, undefined))` is NaN,
  // and NaN loses every comparison: the throttle stops returning and `last` is poisoned, so a
  // 10-second 30fps render writes 300 `NaN%` lines down the MCP stderr channel instead of ~50.
  it('drops a non-finite update instead of logging NaN% and disabling the throttle', () => {
    const { lines, log } = collect();
    const onProgress = createClipProgressHandler('abc123', log);
    onProgress({} as { progress: number });
    onProgress({ progress: Number.NaN });

    expect(lines).toEqual([]);

    onProgress({ progress: 0.5 });
    onProgress({ progress: 0.5 + PROGRESS_STEP / 2 });

    expect(lines).toEqual(['[render_remotion_clip] render abc123 50%']);
  });

  it('always emits the terminal 100%', () => {
    const { lines, log } = collect();
    const onProgress = createClipProgressHandler('abc123', log);
    onProgress({ progress: 0.99 });
    onProgress({ progress: 1 });

    expect(lines.at(-1)).toBe('[render_remotion_clip] render abc123 100%');
  });
});
