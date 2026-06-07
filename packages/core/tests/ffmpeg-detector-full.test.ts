import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Comprehensive coverage suite for FFmpegDetector.
 *
 * Strategy:
 * - All side-effecting dependencies are mocked: `node:child_process` exec (the
 *   source wraps it with promisify), the optionally-installed `ffmpeg-static`
 *   and `@ffmpeg/ffmpeg` / `@ffmpeg/util` packages, and the `Terminal` UI util.
 * - Environment-sensitive branches (window/document/navigator/process.env) are
 *   driven via vi.stubGlobal / vi.stubEnv so each branch is reachable from Node.
 * - We assert on public method outputs (the FFmpegDetectionResult, the
 *   DiagnosticReport, recommendation strings) rather than private internals.
 */

type ExecResult = { stdout: string; stderr: string };

// --- Shared, hoisted mock state -------------------------------------------
// vi.mock factories are hoisted above the file body, so anything they close
// over must be created inside vi.hoisted(). `h` is the single mutable holder
// shared between the factories and the individual tests.
const h = vi.hoisted(() => {
  // Per-test exec behaviour; defaults to a rejection so "not found" is the
  // safe baseline for every branch. Held on the object so tests can swap it.
  const state = {
    execImpl: (async () => {
      throw new Error('default exec rejection');
    }) as (cmd: string) => Promise<{ stdout: string; stderr: string }>,
    // Default export of `ffmpeg-static` (binary path, or null when absent).
    ffmpegStaticPath: '/mocked/path/to/ffmpeg' as string | null,
    // Terminal UI spy surface used by runFullDiagnostics / runInteractiveSetup.
    terminal: {
      showWelcomeBanner: vi.fn(),
      startSpinner: vi.fn(),
      stopSpinner: vi.fn(),
      showSystemInfo: vi.fn(),
      showFFmpegStatus: vi.fn(),
      showSuccess: vi.fn(),
      showInstallationOptions: vi.fn(),
      showInstallationCommands: vi.fn(),
    },
    // Filled in below.
    execMock: undefined as unknown as ReturnType<typeof vi.fn>,
  };

  // The source does `import { exec } from 'node:child_process'` then
  // `promisify(exec)`. Exposing the well-known promisify.custom symbol makes
  // the promisified function delegate straight to the live state.execImpl.
  // (Symbol.for('nodejs.util.promisify.custom') === util.promisify.custom and
  // avoids needing the node:util import to be initialised inside vi.hoisted.)
  const execMock = vi.fn();
  (execMock as unknown as Record<symbol, unknown>)[Symbol.for('nodejs.util.promisify.custom')] = (cmd: string) =>
    state.execImpl(cmd);
  state.execMock = execMock;

  return state;
});

// --- Mock node:child_process ----------------------------------------------
vi.mock('node:child_process', () => ({
  exec: h.execMock,
}));

// --- Mock the optional native/wasm packages -------------------------------
// `ffmpeg-static` default export is the path to the binary (read live so tests
// can flip it between cases).
vi.mock('ffmpeg-static', () => ({
  get default() {
    return h.ffmpegStaticPath;
  },
}));

// `@ffmpeg/ffmpeg` is imported only for its side-effect (an existence probe).
// The happy path resolves cleanly here; the failure path is exercised with a
// per-test vi.doMock override (see the detectWasmFFmpeg failure case).
vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: class {} }));

vi.mock('@ffmpeg/util', () => ({ fetchFile: vi.fn() }));

// --- Mock Terminal so the interactive paths stay silent --------------------
// The source imports Terminal via a relative path that resolves to the same
// module as '@/utils/terminal' (packages/core/src/utils/terminal); register
// both specifiers to be safe.
vi.mock('@/utils/terminal', () => ({ Terminal: h.terminal }));
vi.mock('../src/utils/terminal', () => ({ Terminal: h.terminal }));

// Import AFTER mocks are declared (vi.mock is hoisted, but keep it explicit).
import { FFmpegDetector, FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';

// Aliases so the test bodies read naturally.
const terminalMocks = h.terminal;

// Convenience helpers ------------------------------------------------------
const VERSION_OUTPUT = (v: string): ExecResult => ({
  stdout: `ffmpeg version ${v} Copyright (c) 2000-2024 the FFmpeg developers`,
  stderr: '',
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset controllable state to safe defaults.
  h.execImpl = async () => {
    throw new Error('default exec rejection');
  };
  h.ffmpegStaticPath = '/mocked/path/to/ffmpeg';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('FFmpegDetector (full coverage)', () => {
  // ------------------------------------------------------------------------
  describe('detectSystemFFmpeg', () => {
    it('returns SYSTEM with a parsed version when ffmpeg -version succeeds', async () => {
      h.execImpl = async (cmd) => {
        expect(cmd).toBe('ffmpeg -version');

        return VERSION_OUTPUT('6.1.1');
      };

      const result = await FFmpegDetector.detectSystemFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.SYSTEM);
      expect(result.version).toBe('6.1.1');
      expect(result.path).toBe('system');
      expect(result.error).toBeUndefined();
    });

    it('returns version "unknown" when the output does not match the version regex', async () => {
      h.execImpl = async () => ({ stdout: 'some unrelated output', stderr: '' });

      const result = await FFmpegDetector.detectSystemFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.SYSTEM);
      expect(result.version).toBe('unknown');
    });

    it('returns NONE with an error message when exec throws an Error', async () => {
      h.execImpl = async () => {
        throw new Error('command not found: ffmpeg');
      };

      const result = await FFmpegDetector.detectSystemFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('System FFmpeg not found: command not found: ffmpeg');
    });

    it('falls back to "Unknown error" when a non-Error value is thrown', async () => {
      h.execImpl = async () => {
        throw 'string failure';
      };

      const result = await FFmpegDetector.detectSystemFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('System FFmpeg not found: Unknown error');
    });
  });

  // ------------------------------------------------------------------------
  describe('detectStaticFFmpeg', () => {
    it('returns STATIC with version and the static path when the binary works', async () => {
      h.ffmpegStaticPath = '/opt/ffmpeg-static/ffmpeg';
      h.execImpl = async (cmd) => {
        expect(cmd).toBe('"/opt/ffmpeg-static/ffmpeg" -version');

        return VERSION_OUTPUT('5.0');
      };

      const result = await FFmpegDetector.detectStaticFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.STATIC);
      expect(result.version).toBe('5.0');
      expect(result.path).toBe('/opt/ffmpeg-static/ffmpeg');
    });

    it('returns version "unknown" when static output lacks the version string', async () => {
      h.execImpl = async () => ({ stdout: 'no version here', stderr: '' });

      const result = await FFmpegDetector.detectStaticFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.STATIC);
      expect(result.version).toBe('unknown');
    });

    it('returns NONE when the ffmpeg-static path is null', async () => {
      h.ffmpegStaticPath = null;

      const result = await FFmpegDetector.detectStaticFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('Static FFmpeg not available: ffmpeg-static path is null');
    });

    it('returns NONE when executing the static binary throws an Error', async () => {
      h.execImpl = async () => {
        throw new Error('EACCES');
      };

      const result = await FFmpegDetector.detectStaticFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('Static FFmpeg not available: EACCES');
    });

    it('falls back to "Unknown error" for a non-Error throw', async () => {
      h.execImpl = async () => {
        throw 42;
      };

      const result = await FFmpegDetector.detectStaticFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('Static FFmpeg not available: Unknown error');
    });
  });

  // ------------------------------------------------------------------------
  describe('detectWasmFFmpeg', () => {
    it('returns NONE in a non-browser environment (no window)', async () => {
      // Node baseline: window is undefined.
      expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');

      const result = await FFmpegDetector.detectWasmFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toBe('WebAssembly FFmpeg only available in browser environments');
    });

    it('returns WASM when window is defined and @ffmpeg/ffmpeg imports cleanly', async () => {
      vi.stubGlobal('window', {});

      const result = await FFmpegDetector.detectWasmFFmpeg();

      expect(result.availability).toBe(FFmpegAvailability.WASM);
      expect(result.version).toBe('0.12.x (WebAssembly)');
      expect(result.path).toBe('wasm');
    });

    it('returns NONE when window is defined but importing @ffmpeg/ffmpeg fails', async () => {
      vi.stubGlobal('window', {});
      // Re-mock @ffmpeg/ffmpeg to reject, drop the module cache, then import a
      // fresh copy of the detector so its dynamic `import('@ffmpeg/ffmpeg')`
      // resolves against the throwing mock. (The static vi.mock() registrations
      // for the other dependencies survive resetModules.)
      vi.resetModules();
      vi.doMock('@ffmpeg/ffmpeg', () => {
        throw new Error('wasm module missing');
      });

      const { FFmpegDetector: FreshDetector, FFmpegAvailability: FreshEnum } = await import(
        '@/platform/ffmpeg/FFmpegDetector'
      );

      const result = await FreshDetector.detectWasmFFmpeg();

      expect(result.availability).toBe(FreshEnum.NONE);
      expect(result.error).toContain('WebAssembly FFmpeg not available');

      vi.doUnmock('@ffmpeg/ffmpeg');
    });
  });

  // ------------------------------------------------------------------------
  describe('detect (orchestration / preference order)', () => {
    it('short-circuits to SYSTEM when system ffmpeg is present', async () => {
      h.execImpl = async (cmd) => {
        if (cmd === 'ffmpeg -version') {
          return VERSION_OUTPUT('7.0');
        }

        throw new Error('should not reach static');
      };

      const result = await FFmpegDetector.detect();

      expect(result.availability).toBe(FFmpegAvailability.SYSTEM);
      expect(result.version).toBe('7.0');
    });

    it('falls through to STATIC when system fails but static works', async () => {
      h.execImpl = async (cmd) => {
        if (cmd === 'ffmpeg -version') {
          throw new Error('no system ffmpeg');
        }

        // static binary call
        return VERSION_OUTPUT('5.1');
      };

      const result = await FFmpegDetector.detect();

      expect(result.availability).toBe(FFmpegAvailability.STATIC);
      expect(result.version).toBe('5.1');
      expect(result.path).toBe('/mocked/path/to/ffmpeg');
    });

    it('falls through to WASM when system and static fail but window+wasm exist', async () => {
      vi.stubGlobal('window', {});
      // Both exec calls fail (system + static binary).
      h.execImpl = async () => {
        throw new Error('no native ffmpeg');
      };
      // Also null out static path to be explicit that static is unavailable.
      h.ffmpegStaticPath = null;

      const result = await FFmpegDetector.detect();

      expect(result.availability).toBe(FFmpegAvailability.WASM);
      expect(result.path).toBe('wasm');
    });

    it('returns NONE with guidance when nothing is available', async () => {
      // No window (so wasm NONE), exec rejects (system NONE), static path null.
      h.execImpl = async () => {
        throw new Error('nope');
      };
      h.ffmpegStaticPath = null;

      const result = await FFmpegDetector.detect();

      expect(result.availability).toBe(FFmpegAvailability.NONE);
      expect(result.error).toContain('No FFmpeg implementation found');
    });
  });

  // ------------------------------------------------------------------------
  describe('getInstallationInstructions', () => {
    const originalPlatform = process.platform;

    const setPlatform = (value: NodeJS.Platform) => {
      Object.defineProperty(process, 'platform', { value, configurable: true });
    };

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('returns macOS instructions on darwin', () => {
      setPlatform('darwin');
      const text = FFmpegDetector.getInstallationInstructions();
      expect(text).toContain('macOS');
      expect(text).toContain('brew install ffmpeg');
    });

    it('returns Linux instructions on linux', () => {
      setPlatform('linux');
      const text = FFmpegDetector.getInstallationInstructions();
      expect(text).toContain('Linux');
      expect(text).toContain('apt install ffmpeg');
    });

    it('returns Windows instructions on win32', () => {
      setPlatform('win32');
      const text = FFmpegDetector.getInstallationInstructions();
      expect(text).toContain('Windows');
      expect(text).toContain('choco install ffmpeg');
    });

    it('returns generic instructions for an unknown platform', () => {
      setPlatform('freebsd' as NodeJS.Platform);
      const text = FFmpegDetector.getInstallationInstructions();
      expect(text).toContain('To install FFmpeg');
      expect(text).toContain('ffmpeg-static');
      // Generic branch should NOT include OS-specific package managers.
      expect(text).not.toContain('brew install ffmpeg');
    });
  });

  // ------------------------------------------------------------------------
  describe('environment detection', () => {
    it('isNodeEnvironment returns true when globalThis.process exists', () => {
      expect(FFmpegDetector.isNodeEnvironment()).toBe(true);
    });

    it('isBrowserEnvironment returns false in Node (no window/document)', () => {
      expect(FFmpegDetector.isBrowserEnvironment()).toBe(false);
    });

    it('isBrowserEnvironment returns true when window and document are defined', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});
      expect(FFmpegDetector.isBrowserEnvironment()).toBe(true);
    });

    it('isBrowserEnvironment returns false when only window is defined', () => {
      vi.stubGlobal('window', {});
      // document stays undefined
      expect(FFmpegDetector.isBrowserEnvironment()).toBe(false);
    });

    it('isReactNativeEnvironment returns false for a normal navigator', () => {
      expect(FFmpegDetector.isReactNativeEnvironment()).toBe(false);
    });

    it('isReactNativeEnvironment returns true when navigator.product is ReactNative', () => {
      vi.stubGlobal('navigator', { product: 'ReactNative' });
      expect(FFmpegDetector.isReactNativeEnvironment()).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  describe('getSystemInfo & package manager detection', () => {
    it('builds a system info object using process values', () => {
      const info = FFmpegDetector.getSystemInfo();

      expect(info.os).toBe(`${process.platform} ${process.arch}`);
      expect(info.arch).toBe(process.arch);
      expect(info.nodeVersion).toBe(process.version);
      expect(typeof info.memoryGB).toBe('number');
      expect(info.memoryGB).toBeGreaterThanOrEqual(0);
      expect(['npm', 'pnpm', 'yarn']).toContain(info.packageManager);
    });

    it('defaults the package manager to npm when no user agent is set', () => {
      vi.stubEnv('npm_config_user_agent', '');
      // stubEnv('') yields '' which is falsy -> the !userAgent branch.
      expect(FFmpegDetector.getSystemInfo().packageManager).toBe('npm');
    });

    it('detects pnpm from the user agent', () => {
      vi.stubEnv('npm_config_user_agent', 'pnpm/8.0.0 npm/? node/v22.0.0');
      expect(FFmpegDetector.getSystemInfo().packageManager).toBe('pnpm');
    });

    it('detects yarn from the user agent', () => {
      vi.stubEnv('npm_config_user_agent', 'yarn/1.22.0 npm/? node/v22.0.0');
      expect(FFmpegDetector.getSystemInfo().packageManager).toBe('yarn');
    });

    it('falls back to npm for an unrecognized user agent', () => {
      vi.stubEnv('npm_config_user_agent', 'npm/10.0.0 node/v22.0.0');
      expect(FFmpegDetector.getSystemInfo().packageManager).toBe('npm');
    });
  });

  // ------------------------------------------------------------------------
  describe('checkOptionalDependencies', () => {
    it('reports the installed optional dependencies as importable', async () => {
      const deps = await FFmpegDetector.checkOptionalDependencies();

      // All three are mocked to import successfully in this suite.
      expect(deps).toEqual({
        ffmpegStatic: true,
        ffmpegWasm: true,
        ffmpegUtil: true,
      });
    });

    it('reports a dependency as missing when its import throws (canImport catch branch)', async () => {
      // Make @ffmpeg/util fail to import, then re-import a fresh detector so its
      // private canImport() hits the rejecting path and returns false.
      vi.resetModules();
      vi.doMock('@ffmpeg/util', () => {
        throw new Error('@ffmpeg/util not installed');
      });

      const { FFmpegDetector: FreshDetector } = await import('@/platform/ffmpeg/FFmpegDetector');
      const deps = await FreshDetector.checkOptionalDependencies();

      expect(deps.ffmpegUtil).toBe(false);
      // The other two are still mocked to resolve.
      expect(deps.ffmpegStatic).toBe(true);
      expect(deps.ffmpegWasm).toBe(true);

      vi.doUnmock('@ffmpeg/util');
    });
  });

  // ------------------------------------------------------------------------
  describe('generateRecommendations', () => {
    const baseInfo = (overrides: Partial<{ os: string; memoryGB: number; nodeVersion: string }> = {}) => ({
      os: 'linux x64',
      arch: 'x64',
      nodeVersion: 'v22.0.0',
      packageManager: 'pnpm',
      memoryGB: 8,
      ...overrides,
    });

    const status = (over: {
      system?: boolean;
      static?: boolean;
      wasm?: boolean;
    }): {
      system: { available: boolean; version?: string; error?: string };
      static: { available: boolean; version?: string; error?: string };
      wasm: { available: boolean; version?: string; error?: string };
    } => ({
      system: { available: over.system ?? false },
      static: { available: over.static ?? false },
      wasm: { available: over.wasm ?? false },
    });

    it('recommends installation + macOS hint when nothing is available on darwin', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ os: 'darwin arm64' }), status({}));

      expect(recs.some((r) => r.includes('No FFmpeg found'))).toBe(true);
      expect(recs.some((r) => r.includes('macOS'))).toBe(true);
      expect(recs.some((r) => r.includes('ffmpeg-static'))).toBe(true);
    });

    it('includes the Linux hint when nothing is available on linux', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ os: 'linux x64' }), status({}));
      expect(recs.some((r) => r.includes('Linux'))).toBe(true);
    });

    it('includes the Windows hint when nothing is available on win32', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ os: 'win32 x64' }), status({}));
      expect(recs.some((r) => r.includes('Windows'))).toBe(true);
    });

    it('omits an OS-specific hint for an unrecognized OS but still warns', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ os: 'sunos sparc' }), status({}));

      expect(recs.some((r) => r.includes('No FFmpeg found'))).toBe(true);
      expect(recs.some((r) => r.includes('macOS') || r.includes('Linux') || r.includes('Windows'))).toBe(false);
    });

    it('suggests installing system ffmpeg when only static is available', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo(), status({ static: true }));

      expect(recs.some((r) => r.includes('Consider installing system FFmpeg'))).toBe(true);
      expect(recs.some((r) => r.includes('static FFmpeg works great'))).toBe(true);
      expect(recs.some((r) => r.includes('No FFmpeg found'))).toBe(false);
    });

    it('congratulates the user when system ffmpeg is available', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo(), status({ system: true }));
      expect(recs.some((r) => r.includes('System FFmpeg detected'))).toBe(true);
    });

    it('warns about low memory below 4GB', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ memoryGB: 2 }), status({ system: true }));
      expect(recs.some((r) => r.includes('Low memory detected'))).toBe(true);
    });

    it('praises plentiful memory at 16GB or more', () => {
      const recs = FFmpegDetector.generateRecommendations(baseInfo({ memoryGB: 32 }), status({ system: true }));
      expect(recs.some((r) => r.includes('Plenty of memory'))).toBe(true);
    });

    it('recommends a Node upgrade for versions below 22', () => {
      const recs = FFmpegDetector.generateRecommendations(
        baseInfo({ nodeVersion: 'v18.19.0' }),
        status({ system: true }),
      );
      expect(recs.some((r) => r.includes('upgrading to Node.js 22+'))).toBe(true);
    });

    it('does not recommend a Node upgrade on Node 22+', () => {
      const recs = FFmpegDetector.generateRecommendations(
        baseInfo({ nodeVersion: 'v22.5.0' }),
        status({ system: true }),
      );
      expect(recs.some((r) => r.includes('upgrading to Node.js 22+'))).toBe(false);
    });

    it('handles a malformed node version string without throwing', () => {
      const recs = FFmpegDetector.generateRecommendations(
        baseInfo({ nodeVersion: 'not-a-version' }),
        status({ system: true }),
      );
      // parseInt('not-a-version') -> NaN; NaN < 22 is false, so no upgrade rec.
      expect(recs.some((r) => r.includes('upgrading to Node.js 22+'))).toBe(false);
    });
  });

  // ------------------------------------------------------------------------
  describe('runFullDiagnostics', () => {
    it('produces a report without touching Terminal when showUI is false', async () => {
      h.execImpl = async (cmd) => (cmd === 'ffmpeg -version' ? VERSION_OUTPUT('6.0') : VERSION_OUTPUT('5.0'));

      const report = await FFmpegDetector.runFullDiagnostics(false);

      expect(report.systemInfo).toBeDefined();
      expect(report.ffmpegStatus.system.available).toBe(true);
      expect(report.ffmpegStatus.static.available).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // No UI calls.
      expect(terminalMocks.showWelcomeBanner).not.toHaveBeenCalled();
      expect(terminalMocks.startSpinner).not.toHaveBeenCalled();
      expect(terminalMocks.showSystemInfo).not.toHaveBeenCalled();
      expect(terminalMocks.showFFmpegStatus).not.toHaveBeenCalled();
    });

    it('drives the Terminal UI when showUI is true (default)', async () => {
      // Nothing available -> exercises the error fields in the status object too.
      h.execImpl = async () => {
        throw new Error('no ffmpeg anywhere');
      };
      h.ffmpegStaticPath = null;

      const report = await FFmpegDetector.runFullDiagnostics();

      expect(report.ffmpegStatus.system.available).toBe(false);
      expect(report.ffmpegStatus.static.available).toBe(false);
      expect(report.ffmpegStatus.wasm.available).toBe(false);
      expect(report.ffmpegStatus.system.error).toBeDefined();

      expect(terminalMocks.showWelcomeBanner).toHaveBeenCalledTimes(1);
      expect(terminalMocks.startSpinner).toHaveBeenCalledTimes(2);
      expect(terminalMocks.stopSpinner).toHaveBeenCalledTimes(2);
      expect(terminalMocks.showSystemInfo).toHaveBeenCalledTimes(1);
      expect(terminalMocks.showFFmpegStatus).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------------
  describe('runInteractiveSetup', () => {
    it('returns true and shows success when an FFmpeg implementation is found', async () => {
      h.execImpl = async (cmd) => {
        if (cmd === 'ffmpeg -version') {
          return VERSION_OUTPUT('6.0');
        }

        throw new Error('static not needed');
      };

      const ready = await FFmpegDetector.runInteractiveSetup();

      expect(ready).toBe(true);
      expect(terminalMocks.showSuccess).toHaveBeenCalledTimes(1);
      expect(terminalMocks.showInstallationOptions).not.toHaveBeenCalled();
    });

    it('returns false and shows installation guidance when no FFmpeg is found', async () => {
      h.execImpl = async () => {
        throw new Error('nothing here');
      };
      h.ffmpegStaticPath = null;

      const ready = await FFmpegDetector.runInteractiveSetup();

      expect(ready).toBe(false);
      expect(terminalMocks.showSuccess).not.toHaveBeenCalled();
      expect(terminalMocks.showInstallationOptions).toHaveBeenCalledTimes(1);
      expect(terminalMocks.showInstallationCommands).toHaveBeenCalledTimes(1);
    });
  });
});
