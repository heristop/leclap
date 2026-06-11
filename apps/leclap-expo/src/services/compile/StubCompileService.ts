import type { CompileInput, CompileOptions, CompileResult, CompileService } from './CompileService';

/**
 * A no-FFmpeg stand-in so the Builder wizard (Phase 2) is fully buildable and testable in a
 * simulator before on-device FFmpeg lands (Phase 3). It walks the same progress stages the real
 * compiler will, then echoes the first recorded clip back as the "output" so the Result step has
 * something to preview. It never spawns a server and never renders — color-only templates (no clip
 * to echo) report that the on-device compiler is required.
 */

const STAGES = ['Preparing', 'Processing clips', 'Adding overlays', 'Finalizing'] as const;

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) {
      resolve();

      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });

const toFileUri = (path: string): string => (path.startsWith('file://') ? path : `file://${path}`);

export class StubCompileService implements CompileService {
  /** Per-stage delay; tests pass 0 to run instantly. */
  constructor(private readonly delayMs = 250) {}

  async compile(input: CompileInput, options: CompileOptions = {}): Promise<CompileResult> {
    const { onProgress, signal } = options;

    // Run stages sequentially via a promise chain so progress ticks one step at a
    // time (a plain await-in-for-loop trips the no-await-in-loop rule).
    await STAGES.reduce(
      (prev, stage, i) =>
        prev.then(async () => {
          if (signal?.aborted) {
            return;
          }

          await sleep(this.delayMs, signal);
          onProgress?.({ ratio: (i + 1) / STAGES.length, stage });
        }),
      Promise.resolve()
    );

    if (signal?.aborted) {
      return { success: false, error: 'Compilation cancelled.' };
    }

    const firstClip = Object.values(input.clips).at(0);

    if (firstClip?.path) {
      return { success: true, outputUri: toFileUri(firstClip.path) };
    }

    return { success: false, error: 'Stub compiler has no clip to return — on-device compiler required.' };
  }
}
