import { StubCompileService } from './StubCompileService';
import type { CompileInput, CompileProgress } from './CompileService';

const inputWithClip = (path = '/tmp/clip.mp4'): CompileInput => ({
  descriptor: { global: { orientation: 'portrait' }, sections: [] },
  clips: { video_1: { path, orientation: 'portrait' } },
});

describe('StubCompileService', () => {
  it('walks every progress stage ending at ratio 1 and returns the clip as a file:// uri', async () => {
    const progress: CompileProgress[] = [];
    const service = new StubCompileService(0);

    const result = await service.compile(inputWithClip('/tmp/clip.mp4'), {
      onProgress: (p) => progress.push(p),
    });

    expect(result).toEqual({ success: true, outputUri: 'file:///tmp/clip.mp4' });
    expect(progress).toHaveLength(4);
    expect(progress.at(-1)?.ratio).toBe(1);
    // ratios are monotonically increasing
    expect(progress.map((p) => p.ratio)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('preserves an existing file:// prefix instead of doubling it', async () => {
    const service = new StubCompileService(0);

    const result = await service.compile(inputWithClip('file:///already/uri.mp4'));

    expect(result.outputUri).toBe('file:///already/uri.mp4');
  });

  it('fails clearly when there is no clip to echo back (e.g. color-only template)', async () => {
    const service = new StubCompileService(0);

    const result = await service.compile({
      descriptor: { sections: [{ name: 'color_1', type: 'color_background' }] },
      clips: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/on-device compiler required/i);
  });

  it('resolves to a cancelled result when the signal is already aborted', async () => {
    const service = new StubCompileService(0);
    const controller = new AbortController();
    controller.abort();

    const result = await service.compile(inputWithClip(), { signal: controller.signal });

    expect(result).toEqual({ success: false, error: 'Compilation cancelled.' });
  });
});
