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
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Compilation completed successfully'));
  });
});
