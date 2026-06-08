import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PlatformBridge from '@/platform/PlatformBridge';
import FFmpegNodeAdapter from '@/platform/ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from '@/platform/ffmpeg/FFmpegStaticAdapter';
import { FFmpegDetector, FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';

// Mirror the mocks from tests/platform.test.ts so we never touch the real FFmpeg toolchain.
vi.mock('@/platform/ffmpeg/FFmpegDetector');

vi.mock('@/platform/ffmpeg/FFmpegWasmAdapter', () => {
  class MockFFmpegWasmAdapter {
    execute = vi.fn();
    getInfos = vi.fn();
    waitForReady = vi.fn();
  }
  return { default: MockFFmpegWasmAdapter };
});

// Mock the Terminal so interactive-setup branches don't print spinners / boxes.
vi.mock('@/utils/terminal', () => ({
  Terminal: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    showError: vi.fn(),
    showSystemInfo: vi.fn(),
    showInstallationCommands: vi.fn(),
  },
}));

import { Terminal } from '@/utils/terminal';

/**
 * Switch PlatformBridge into "interactive" mode by making
 * shouldShowInteractiveSetup() return true (no CI, not test env, TTY present).
 */
function enableInteractive() {
  delete process.env.CI;
  process.env.NODE_ENV = 'development';
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  // Speed up the artificial 1.5s spinner delay.
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
}

describe('PlatformBridge - uncovered branches', () => {
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('environment helpers', () => {
    it('isBrowserEnvironment is false under Node', () => {
      expect(new PlatformBridge().isBrowserEnvironment()).toBe(false);
    });

    it('isReactNativeEnvironment reflects navigator.product', () => {
      const bridge = new PlatformBridge();
      vi.stubGlobal('navigator', { product: 'ReactNative' });
      expect(bridge.isReactNativeEnvironment()).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe('create() validation', () => {
    it('rejects an unknown adapter with a TypeError', async () => {
      await expect(new PlatformBridge().create('bogus')).rejects.toThrow(TypeError);
    });
  });

  describe('createFFmpegAdapter caching', () => {
    it('returns the cached adapter on the second call without re-detecting', async () => {
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.SYSTEM,
        version: '8.0',
        path: 'system',
      });
      const bridge = new PlatformBridge();
      const first = await bridge.create('ffmpeg');
      const second = await bridge.create('ffmpeg');
      expect(first).toBe(second);
      expect(first).toBeInstanceOf(FFmpegNodeAdapter);
      // detect() only ran for the first create.
      expect(vi.mocked(FFmpegDetector).detect).toHaveBeenCalledTimes(1);
    });
  });

  describe('createFFmpegAdapter error handling (non-interactive)', () => {
    it('wraps detection failures and logs to console.error', async () => {
      vi.mocked(FFmpegDetector).detect.mockRejectedValue(new Error('detector exploded'));
      process.env.NODE_ENV = 'test'; // shouldShowInteractiveSetup() => false

      await expect(new PlatformBridge().create('ffmpeg')).rejects.toThrow(
        'Failed to create FFmpeg adapter: detector exploded'
      );
      expect(console.error).toHaveBeenCalledWith(
        '[PlatformBridge] FFmpeg adapter creation failed:',
        'detector exploded'
      );
    });

    it('uses the Unknown error fallback for non-Error throws', async () => {
      vi.mocked(FFmpegDetector).detect.mockRejectedValue('weird failure');
      process.env.NODE_ENV = 'test';

      await expect(new PlatformBridge().create('ffmpeg')).rejects.toThrow(
        'Failed to create FFmpeg adapter: Unknown error during FFmpeg detection'
      );
    });

    it('throws a descriptive error when no FFmpeg is available (NONE, non-interactive)', async () => {
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.NONE,
        error: 'nothing here',
      });
      vi.mocked(FFmpegDetector).getInstallationInstructions.mockReturnValue('install me');
      process.env.NODE_ENV = 'test';

      await expect(new PlatformBridge().create('ffmpeg')).rejects.toThrow(
        /Failed to create FFmpeg adapter: No FFmpeg implementation available\. nothing here/
      );
    });
  });

  describe('interactive setup branches', () => {
    it('shows the welcome UI + spinner and SYSTEM success messaging', async () => {
      enableInteractive();
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.SYSTEM,
        version: '8.0',
        path: 'system',
      });

      const adapter = await new PlatformBridge().create('ffmpeg');
      expect(adapter).toBeInstanceOf(FFmpegNodeAdapter);
      expect(Terminal.startSpinner).toHaveBeenCalled();
      expect(Terminal.stopSpinner).toHaveBeenCalledWith('success', 'Detection complete!');
      expect(console.log).toHaveBeenCalled();
    });

    it('shows STATIC fallback messaging', async () => {
      enableInteractive();
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.STATIC,
        version: '6.0',
        path: '/static/ffmpeg',
      });

      const adapter = await new PlatformBridge().create('ffmpeg');
      expect(adapter).toBeInstanceOf(FFmpegStaticAdapter);
    });

    it('shows WASM/browser-mode messaging', async () => {
      enableInteractive();
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.WASM,
        version: '0.12.x (WebAssembly)',
        path: 'wasm',
      });

      const adapter = await new PlatformBridge().create('ffmpeg');
      expect(adapter).toBeDefined();
    });
  });

  describe('handleFirstRunSetup (interactive, no FFmpeg)', () => {
    const setupSuggestionTest = (os: string) => async () => {
      enableInteractive();
      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.NONE,
        error: 'none found',
      });
      vi.mocked(FFmpegDetector).getSystemInfo.mockReturnValue({
        os,
        arch: 'x64',
        nodeVersion: 'v22',
        platform: os,
      } as never);

      await expect(new PlatformBridge().create('ffmpeg')).rejects.toThrow(
        'Failed to create FFmpeg adapter: FFmpeg setup required. Please follow the installation instructions above.'
      );
      expect(Terminal.showSystemInfo).toHaveBeenCalled();
      expect(Terminal.showError).toHaveBeenCalledWith('No FFmpeg implementation found', expect.any(Array));
      expect(Terminal.showInstallationCommands).toHaveBeenCalledWith(os);
    };

    it('suggests Homebrew on darwin', setupSuggestionTest('darwin'));
    it('suggests apt on linux', setupSuggestionTest('linux'));
    it('suggests the ffmpeg.org download on win32', setupSuggestionTest('win32'));
    it('falls back to ffmpeg-static on unknown platforms', setupSuggestionTest('sunos'));
  });

  describe('shouldShowInteractiveSetup gating', () => {
    it('does not show UI when no TTY is present', async () => {
      delete process.env.CI;
      process.env.NODE_ENV = 'development';
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.SYSTEM,
        version: '8.0',
        path: 'system',
      });

      await new PlatformBridge().create('ffmpeg');
      expect(Terminal.startSpinner).not.toHaveBeenCalled();
    });

    it('does not show UI when CI is set', async () => {
      process.env.CI = 'true';
      process.env.NODE_ENV = 'development';
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      vi.mocked(FFmpegDetector).detect.mockResolvedValue({
        availability: FFmpegAvailability.SYSTEM,
        version: '8.0',
        path: 'system',
      });

      await new PlatformBridge().create('ffmpeg');
      expect(Terminal.startSpinner).not.toHaveBeenCalled();
    });
  });
});

describe('PlatformBridge.resolvePlatform via create() (platform overrides)', () => {
  // A fake process that has no versions.node (so resolvePlatform skips the node
  // branch) but still exposes cwd() so FilesystemNodeAdapter can instantiate.
  const fakeProcess = { versions: {}, env: {}, cwd: () => '/' };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves the browser platform when window+document exist and process lacks node', async () => {
    vi.stubGlobal('process', fakeProcess);
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});

    // browser maps to FilesystemNodeAdapter in classesMapping.
    const adapter = await new PlatformBridge().create('filesystem');
    expect(adapter).toBeDefined();
  });

  it('resolves the react-native platform via navigator.product', async () => {
    vi.stubGlobal('process', fakeProcess);
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', { product: 'ReactNative' });

    const adapter = await new PlatformBridge().create('music');
    expect(adapter).toBeDefined();
  });

  it('throws Unsupported platform when nothing matches', async () => {
    vi.stubGlobal('process', fakeProcess);
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', { product: 'not-rn' });

    await expect(new PlatformBridge().create('logger')).rejects.toThrow('Unsupported platform');
  });
});
