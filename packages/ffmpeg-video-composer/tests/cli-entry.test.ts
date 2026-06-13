import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compileMock = vi.fn();
const loadConfigMock = vi.fn();

vi.mock('../src/index', () => ({
  compile: (...args: unknown[]) => compileMock(...args),
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
  FFmpegDetector: {
    runFullDiagnostics: vi.fn(),
  },
  Terminal: {
    showError: vi.fn(),
    showSuccess: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async () => JSON.stringify({ version: '0.0.0', author: 'test', license: 'MIT', repository: {} })),
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

const settleAutoRun = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('cli.ts auto-run', () => {
  const originalArgv = process.argv;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.argv = ['node', 'leclap', 'template.json'];
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockResolvedValue('/build/final.mp4');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exits with failure when compilation resolves without an output path', async () => {
    compileMock.mockResolvedValue(null);

    await import('../src/cli');
    await settleAutoRun();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Compilation failed to produce output'));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Compilation completed successfully'));
  });
});
