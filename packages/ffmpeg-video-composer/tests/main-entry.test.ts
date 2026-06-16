import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// main.ts wraps the index.compile()/loadConfig() pipeline with CLI niceties
// (banner, spinner, error handling). We mock '@/index' so nothing touches a
// real FFmpeg, and drive main() directly.
// ---------------------------------------------------------------------------

const compileMock = vi.fn();
const loadConfigMock = vi.fn();

vi.mock('@/index', () => ({
  compile: (...args: unknown[]) => compileMock(...args),
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

// Avoid touching the real terminal spinner / colors.
vi.mock('@/utils/terminal', () => ({
  Terminal: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    showError: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: { mkdir: vi.fn(async () => undefined) },
}));

// picocolors is pure formatting; a passthrough keeps assertions simple.
vi.mock('picocolors', () => {
  const id = (s: string) => s;

  return { default: { red: id, bold: id, cyan: id, dim: id, yellow: id } };
});

async function loadMain() {
  // argv[2] empty so the module-level auto-run block stays dormant on import.
  const mod = await import('@/main');

  return mod.main;
}

describe('main.ts', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.argv = ['node', 'main'];
    // Force the non-welcome path by default (CI on).
    process.env.CI = '1';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
    process.env = { ...originalEnv };
  });

  it('returns the compiled output path on success', async () => {
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockResolvedValue('/build/final.mp4');

    const main = await loadMain();
    const result = await main('config.json');

    expect(result).toBe('/build/final.mp4');
    expect(loadConfigMock).toHaveBeenCalledWith('config.json');
    expect(compileMock).toHaveBeenCalled();
  });

  it('shows the welcome banner on an interactive first run', async () => {
    delete process.env.CI;
    delete process.env.FFMPEG_COMPOSER_SKIP_WELCOME;
    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockResolvedValue('/build/final.mp4');

    try {
      const main = await loadMain();
      await main('config.json');
      // welcome banner prints a line containing the app name
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Welcome to FFmpeg Video Composer (by LeClap)'));
    } finally {
      if (ttyDescriptor) {
        Object.defineProperty(process.stdout, 'isTTY', ttyDescriptor);
      }
    }
  });

  it('skips the welcome banner when the skip env var is set', async () => {
    delete process.env.CI;
    process.env.FFMPEG_COMPOSER_SKIP_WELCOME = '1';
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockResolvedValue('/build/final.mp4');

    const main = await loadMain();
    await main('config.json');
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Welcome to FFmpeg Video Composer (by LeClap)'));
  });

  it('handles a generic compilation Error by exiting', async () => {
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockRejectedValue(new Error('something broke'));

    const main = await loadMain();
    await expect(main('config.json')).rejects.toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('something broke'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('surfaces FFmpeg-specific guidance when the error mentions FFmpeg', async () => {
    const { Terminal } = await import('@/utils/terminal');
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockRejectedValue(new Error('FFmpeg not found on PATH'));

    const main = await loadMain();
    await expect(main('config.json')).rejects.toThrow('process.exit called');
    expect(Terminal.showError).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('FFmpeg Issue Detected'));
  });

  it('handles a non-Error compilation rejection by exiting', async () => {
    loadConfigMock.mockResolvedValue({ sections: [] });
    compileMock.mockRejectedValue('weird string failure');

    const main = await loadMain();
    await expect(main('config.json')).rejects.toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith('Unknown error:', 'weird string failure');
  });

  // The module-level auto-run block executes on import when argv[2] is present.
  // These cases set argv[2] before importing to cover runMain() and that block.
  describe('module auto-run (argv-driven)', () => {
    beforeEach(() => {
      // In the auto-run block exit() is reached via a fire-and-forget promise;
      // a no-op keeps control flow linear and assertions clean.
      exitSpy.mockImplementation(((): never => undefined as never) as never);
    });

    async function importWithArg(arg: string) {
      vi.resetModules();
      process.argv = ['node', 'main', arg];
      await import('@/main');
      // let the fire-and-forget runMain() promise settle
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    it('auto-runs and logs success when compile yields a path', async () => {
      loadConfigMock.mockResolvedValue({ sections: [] });
      compileMock.mockResolvedValue('/build/auto.mp4');
      await importWithArg('auto-config.json');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Compilation successful: /build/auto.mp4'));
    });

    it('auto-runs and exits when compile yields no output', async () => {
      loadConfigMock.mockResolvedValue({ sections: [] });
      compileMock.mockResolvedValue(null);
      await importWithArg('auto-config.json').catch(() => undefined);
      expect(errorSpy).toHaveBeenCalledWith('Compilation failed to produce output');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('auto-run catch handles an Error thrown before compilation', async () => {
      loadConfigMock.mockRejectedValue(new Error('config load failed'));
      await importWithArg('auto-config.json').catch(() => undefined);
      expect(errorSpy).toHaveBeenCalledWith('Error:', 'config load failed');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('auto-run catch handles a non-Error thrown before compilation', async () => {
      loadConfigMock.mockRejectedValue('plain non-error');
      await importWithArg('auto-config.json').catch(() => undefined);
      expect(errorSpy).toHaveBeenCalledWith('Unknown error:', 'plain non-error');
    });
  });
});
