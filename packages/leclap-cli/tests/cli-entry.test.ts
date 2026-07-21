import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compileMock = vi.fn();
const loadConfigMock = vi.fn();

vi.mock('ffmpeg-video-composer', () => ({
  compile: (...args: unknown[]) => compileMock(...args),
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
  Terminal: {
    showError: vi.fn(),
    showSuccess: vi.fn(),
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
  },
}));

vi.mock('picocolors', () => {
  const passthrough = (value: string) => value;

  return {
    default: {
      blue: passthrough,
      bold: passthrough,
      cyan: passthrough,
      dim: passthrough,
      green: passthrough,
      red: passthrough,
      yellow: passthrough,
    },
  };
});

describe('render command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockResolvedValue('/build/final.mp4');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exits with failure when compilation resolves without an output path', async () => {
    compileMock.mockResolvedValue(null);

    const { render } = await import('../src/commands/render');
    await render.run?.({ args: { template: 'x.json' } } as never);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Compilation failed to produce output'));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Rendered'));
  });

  it('emits a machine-readable JSON error (not human stderr) in --json mode when the template is missing', async () => {
    const fsMod = (await import('node:fs/promises')).default;
    vi.mocked(fsMod.access).mockRejectedValueOnce(new Error('ENOENT'));
    // Halt at the first exit(1) so the assertion sees only the error output, not a later render.
    exitSpy.mockImplementation(((code?: number): never => {
      throw new Error(`exit:${code}`);
    }) as never);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const { render } = await import('../src/commands/render');
    await expect(render.run?.({ args: { template: 'missing.json', json: true } } as never)).rejects.toThrow('exit:1');

    const out = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(out).toContain('"ok":false');
    expect(out).toContain('missing.json');
    expect(errorSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
