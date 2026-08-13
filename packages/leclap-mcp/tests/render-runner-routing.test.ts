import { describe, expect, it, vi } from 'vitest';

import { routeWorkerMessage } from '../src/compose/renderRunner.js';

describe('routeWorkerMessage', () => {
  it('sends a progress message to onProgress and never to onResult', () => {
    const onProgress = vi.fn();
    const onResult = vi.fn();

    routeWorkerMessage({ kind: 'progress', fraction: 0.25 }, { onProgress, onResult });

    expect(onProgress).toHaveBeenCalledWith(0.25);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('sends a terminal result to onResult and never to onProgress', () => {
    const onProgress = vi.fn();
    const onResult = vi.fn();
    const message = { ok: true, outputPath: '/tmp/out.mp4', sizeBytes: 10 };

    routeWorkerMessage(message, { onProgress, onResult });

    expect(onResult).toHaveBeenCalledWith(message);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('treats a message without a kind as terminal even when it looks empty', () => {
    const onResult = vi.fn();

    routeWorkerMessage({ ok: false }, { onProgress: vi.fn(), onResult });

    expect(onResult).toHaveBeenCalledWith({ ok: false });
  });

  it('tolerates a missing onProgress handler', () => {
    expect(() => routeWorkerMessage({ kind: 'progress', fraction: 1 }, { onResult: vi.fn() })).not.toThrow();
  });
});
