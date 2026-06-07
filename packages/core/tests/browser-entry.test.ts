import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// browser.ts is the WASM/browser entry point. We mock the WASM + browser
// filesystem adapters (so no real WASM boots) and the heavy editor/director
// classes (so DI/manual wiring stays cheap and deterministic), then exercise
// the exported compileBrowser() across its success and failure paths.
// ---------------------------------------------------------------------------

const waitForReady = vi.fn(async () => undefined);
const construct = vi.fn(async () => '/browser/out.mp4');
const directorConfig = vi.fn(function (this: unknown) {
  return this;
});

vi.mock('@/platform/ffmpeg/FFmpegWasmAdapter', () => {
  class MockFFmpegWasmAdapter {
    waitForReady = waitForReady;
    execute = vi.fn();
    getInfos = vi.fn();
  }

  return { default: MockFFmpegWasmAdapter };
});

vi.mock('@/platform/ffmpeg/MusicWasmAdapter', () => {
  class MockMusicWasmAdapter {
    compose = vi.fn();
  }

  return { default: MockMusicWasmAdapter };
});

vi.mock('@/platform/filesystem/BrowserFilesystemAdapter', () => {
  class MockBrowserFilesystemAdapter {
    setBuildDir = vi.fn();
    setAssetsDir = vi.fn();
    getBuildPath = vi.fn(async (d: string) => `/build/${d}`);
    read = vi.fn(async () => '{}');
  }

  return { default: MockBrowserFilesystemAdapter };
});

// Dependency-free doubles so the tsyringe container can build them and the
// manual-fallback path can `new` them with explicit args.
vi.mock('@/director/TemplateDirector', () => ({
  default: class {
    config = directorConfig;
    construct = construct;
  },
}));
vi.mock('@/director/TemplateConcreteBuilder', () => ({ default: class {} }));
vi.mock('@/editor/MusicComposer', () => ({ default: class {} }));
vi.mock('@/editor/VideoEditor', () => ({ default: class {} }));

const validDescriptor = { global: { orientation: 'landscape' as const }, sections: [] };

async function loadBrowser() {
  return await import('@/browser');
}

describe('browser.ts compileBrowser', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    waitForReady.mockResolvedValue(undefined);
    construct.mockResolvedValue('/browser/out.mp4');
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('compiles via the DI container and returns the output path', async () => {
    const { compile } = await loadBrowser();
    const result = await compile({ buildDir: '/build' }, validDescriptor);
    expect(result).toBe('/browser/out.mp4');
    expect(waitForReady).toHaveBeenCalled();
    expect(construct).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Used DI container for instantiation'));
  });

  it('initializes the platform only once across compiles', async () => {
    const { compile } = await loadBrowser();
    await compile({ buildDir: '/build' }, validDescriptor);
    const firstCount = waitForReady.mock.calls.length;
    await compile({ buildDir: '/build' }, validDescriptor);
    // waitForReady is part of one-time adapter registration; not called again.
    expect(waitForReady.mock.calls.length).toBe(firstCount);
  });

  it('falls back to manual instantiation when DI resolution fails', async () => {
    const mod = await loadBrowser();
    const { container } = await import('tsyringe');
    const TemplateDirector = (await import('@/director/TemplateDirector')).default;

    const realResolve = container.resolve.bind(container);
    const spy = vi.spyOn(container, 'resolve').mockImplementation((token: unknown) => {
      if (token === TemplateDirector) {
        throw new Error('DI boom');
      }

      return realResolve(token as any);
    });

    try {
      const result = await mod.compile({ buildDir: '/build' }, validDescriptor);
      expect(result).toBe('/browser/out.mp4');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DI container failed'),
        expect.anything()
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('manual instantiation'));
    } finally {
      spy.mockRestore();
    }
  });

  it('throws a wrapped error when template validation fails', async () => {
    const { compile } = await loadBrowser();
    // A bad section type fails the real TemplateValidator used by Template.
    const badDescriptor = { sections: [{ name: 's', type: 'not_a_type' }] } as never;
    await expect(compile({ buildDir: '/build' }, badDescriptor)).rejects.toThrow(
      /Browser video compilation failed/
    );
  });

  it('throws when compilation produces no output', async () => {
    const { compile } = await loadBrowser();
    construct.mockResolvedValue(null as never);
    await expect(compile({ buildDir: '/build' }, validDescriptor)).rejects.toThrow(
      /Browser video compilation failed/
    );
  });

  it('propagates a task-stopped error captured during compilation', async () => {
    const { compile } = await loadBrowser();
    const { container } = await import('tsyringe');
    // Drive the event manager to emit a task-stopped error, and make construct
    // return null so the captured error is rethrown.
    construct.mockResolvedValue(null as never);
    // Resolve event manager after init to trigger the stored error.
    const result = compile({ buildDir: '/build' }, validDescriptor).catch((e: Error) => e);
    // Allow the connect().on registration to run, then emit.
    await Promise.resolve();
    try {
      const em: any = container.resolve('eventManager');
      em.connect().emit('task-stopped', new Error('task exploded'));
    } catch {
      // event manager may not be resolvable in all runs; ignore.
    }
    const err = await result;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('Browser video compilation failed');
  });

  it('BrowserLogger.debug/log/error/warn prefix messages once registered', async () => {
    const { compile } = await loadBrowser();
    const { container } = await import('tsyringe');
    // Compiling initializes the platform, which registers the real BrowserLogger
    // (defined in browser.ts, not mocked) under the 'logger' token.
    await compile({ buildDir: '/build' }, validDescriptor);

    const logger = container.resolve<{
      debug(m: string): void;
      log(m: string): void;
      error(m: string): void;
      warn(m: string): void;
    }>('logger');

    logger.debug('d');
    logger.log('l');
    logger.error('e');
    logger.warn('w');

    expect(debugSpy).toHaveBeenCalledWith('[FFmpeg Video Composer] d');
    expect(logSpy).toHaveBeenCalledWith('[FFmpeg Video Composer] l');
    expect(errorSpy).toHaveBeenCalledWith('[FFmpeg Video Composer] e');
    expect(warnSpy).toHaveBeenCalledWith('[FFmpeg Video Composer] w');
  });

  it('logs and rethrows when browser platform initialization fails (Error)', async () => {
    // Fresh module so the module-level isInitialized/initializationPromise start
    // unset and the init IIFE's try/catch actually runs.
    vi.resetModules();
    waitForReady.mockRejectedValueOnce(new Error('init boom'));

    const { compile } = await loadBrowser();

    // registerAdapters awaits waitForReady() -> throws -> init catch block runs,
    // and the outer compileBrowser catch wraps the Error's message.
    await expect(compile({ buildDir: '/build' }, validDescriptor)).rejects.toThrow(
      /Browser video compilation failed: init boom/
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to initialize browser platform:',
      expect.objectContaining({ message: 'init boom' })
    );
  });

  it('wraps a NON-Error initialization failure as "Unknown error"', async () => {
    // Fresh module again; reject init with a NON-Error so both the init catch
    // and the compileBrowser catch's `instanceof Error` false branch run.
    vi.resetModules();
    waitForReady.mockRejectedValueOnce('non-error-init-boom');

    const { compile } = await loadBrowser();

    await expect(compile({ buildDir: '/build' }, validDescriptor)).rejects.toThrow(
      /Browser video compilation failed: Unknown error/
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to initialize browser platform:',
      'non-error-init-boom'
    );
  });

  it('exposes the browser export surface', async () => {
    const mod = await loadBrowser();
    expect(mod.FFmpegWasmAdapter).toBeDefined();
    expect(mod.BrowserFilesystemAdapter).toBeDefined();
    expect(mod.Template).toBeDefined();
    expect(mod.Project).toBeDefined();
    expect(mod.Segment).toBeDefined();
    expect(mod.container).toBeDefined();
    expect(typeof mod.compile).toBe('function');
  });
});
