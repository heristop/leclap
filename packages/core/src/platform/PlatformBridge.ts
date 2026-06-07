import PinoLogAdapter from './logging/PinoLogAdapter';
import FFmpegNodeAdapter from './ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from './ffmpeg/FFmpegStaticAdapter';
import FFmpegWasmAdapter from './ffmpeg/FFmpegWasmAdapter';
import type AbstractFFmpeg from './ffmpeg/AbstractFFmpeg';
import MusicNodeAdapter from './ffmpeg/MusicNodeAdapter';
import FilesystemNodeAdapter from './filesystem/FilesystemNodeAdapter';
import { FFmpegDetector, FFmpegAvailability } from './ffmpeg/FFmpegDetector';
import { Terminal } from '../utils/terminal';
import pc from 'picocolors';

type AdapterName = 'logger' | 'filesystem' | 'music';
type PlatformKey = 'node' | 'browser' | 'reactnative';

// Loose constructor type so DI-decorated classes work without their injected args here
type AdapterConstructor = new (...args: never[]) => object;

const classesMapping: Record<AdapterName, Record<PlatformKey, AdapterConstructor>> = {
  logger: {
    node: PinoLogAdapter,
    browser: PinoLogAdapter, // Can work in browser with polyfills
    reactnative: PinoLogAdapter,
  },
  filesystem: {
    node: FilesystemNodeAdapter,
    browser: FilesystemNodeAdapter, // Limited functionality
    reactnative: FilesystemNodeAdapter, // Would need RN-specific implementation
  },
  music: {
    node: MusicNodeAdapter,
    browser: MusicNodeAdapter, // Limited functionality
    reactnative: MusicNodeAdapter, // Would need RN-specific implementation
  },
};

const isAdapterName = (name: string): name is AdapterName =>
  name === 'logger' || name === 'filesystem' || name === 'music';

function resolvePlatform(): PlatformKey {
  if (typeof globalThis.process !== 'undefined' && typeof globalThis.process.versions.node === 'string') {
    return 'node';
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  if (navigator.product === 'ReactNative') {
    return 'reactnative';
  }

  throw new Error('Unsupported platform');
}

function resolveFFmpegSuggestions(platform: string): string[] {
  if (platform.includes('darwin')) {
    return ['🍺 brew install ffmpeg (recommended)', '📦 pnpm add ffmpeg-static (quick setup)'];
  }

  if (platform.includes('linux')) {
    return ['🐧 sudo apt install ffmpeg (Ubuntu/Debian)', '📦 pnpm add ffmpeg-static (quick setup)'];
  }

  if (platform.includes('win32')) {
    return ['🪟 Download from https://ffmpeg.org/download.html', '📦 pnpm add ffmpeg-static (quick setup)'];
  }

  return ['📦 pnpm add ffmpeg-static (universal solution)'];
}

class PlatformBridge {
  private ffmpegAdapterCache: AbstractFFmpeg | null = null;
  private isFirstRun = true;

  create = async (adapter: string) => {
    if (!['logger', 'ffmpeg', 'filesystem', 'music'].includes(adapter)) {
      throw new TypeError(`Wrong adapter: ${adapter}`);
    }

    if (adapter === 'ffmpeg') {
      return await this.createFFmpegAdapter();
    }

    const platform = resolvePlatform();

    if (!isAdapterName(adapter)) {
      throw new Error(`No ${adapter} adapter available for platform: ${platform}`);
    }

    const AdapterClass = classesMapping[adapter][platform];

    return new AdapterClass();
  };

  /**
   * Show detection spinner and run FFmpeg detection
   */
  private async detectWithSpinner(): Promise<ReturnType<typeof FFmpegDetector.detect>> {
    if (this.isFirstRun && this.shouldShowInteractiveSetup()) {
      console.log(pc.cyan('\n🎬 Welcome to FFmpeg Video Composer! 🎬\n'));
      Terminal.startSpinner('🔍 Detecting FFmpeg installations...');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const detection = await FFmpegDetector.detect();

    if (this.isFirstRun && this.shouldShowInteractiveSetup()) {
      Terminal.stopSpinner('success', 'Detection complete!');
    }

    return detection;
  }

  /**
   * Build an adapter instance from a detection result
   */
  private buildAdapterFromDetection(detection: Awaited<ReturnType<typeof FFmpegDetector.detect>>): AbstractFFmpeg {
    const showUI = this.shouldShowInteractiveSetup();

    switch (detection.availability) {
      case FFmpegAvailability.SYSTEM: {
        if (showUI) {
          console.log(
            `${pc.green('✅')} ${pc.bold('Found:')} Using system FFmpeg ${pc.dim(`(${detection.version})`)}`
          );
          console.log(`${pc.cyan('🚀')} ${pc.dim('Fastest processing speed')}\n`);
        }

        return new FFmpegNodeAdapter();
      }

      case FFmpegAvailability.STATIC: {
        if (showUI) {
          console.log(
            `${pc.yellow('📦')} ${pc.bold('Found:')} Using static FFmpeg ${pc.dim(`(${detection.version})`)}`
          );
          console.log(`${pc.dim('💡 Consider installing system FFmpeg for faster processing')}\n`);
        }

        return new FFmpegStaticAdapter();
      }

      case FFmpegAvailability.WASM: {
        if (showUI) {
          console.log(
            `${pc.magenta('🌐')} ${pc.bold('Browser mode!')} Using WebAssembly FFmpeg ${pc.dim(`(${detection.version})`)}`
          );
          console.log(`${pc.dim('⚠️ Limited to 2GB files and slower processing')}\n`);
        }
        // FFmpegWasmAdapter requires AbstractFilesystem via DI;
        // providing FilesystemNodeAdapter with PinoLogAdapter as the concrete implementation.
        return new FFmpegWasmAdapter(new FilesystemNodeAdapter(new PinoLogAdapter()));
      }

      default: {
        const errorMessage = `No FFmpeg implementation available. ${detection.error}\n\n${FFmpegDetector.getInstallationInstructions()}`;

        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Create FFmpeg adapter with fallback detection
   */
  private readonly createFFmpegAdapter = async () => {
    if (this.ffmpegAdapterCache) {
      return this.ffmpegAdapterCache;
    }

    try {
      const detection = await this.detectWithSpinner();

      if (detection.availability === FFmpegAvailability.NONE && this.shouldShowInteractiveSetup()) {
        return await this.handleFirstRunSetup();
      }

      const adapter = this.buildAdapterFromDetection(detection);

      this.ffmpegAdapterCache = adapter;
      this.isFirstRun = false;

      return adapter;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during FFmpeg detection';

      if (!this.shouldShowInteractiveSetup()) {
        console.error('[PlatformBridge] FFmpeg adapter creation failed:', message);

        throw new Error(`Failed to create FFmpeg adapter: ${message}`);
      }

      Terminal.showError(message, [
        'Check FFmpeg installation',
        'Run diagnostic: pnpm diagnose',
        'Install static fallback: pnpm add ffmpeg-static',
      ]);

      throw new Error(`Failed to create FFmpeg adapter: ${message}`);
    }
  };

  /**
   * Handle first-run setup when no FFmpeg is found
   */
  private async handleFirstRunSetup(): Promise<AbstractFFmpeg> {
    console.log(`${pc.red('😱')} ${pc.bold('Oops! No FFmpeg found!')}\n`);

    const systemInfo = FFmpegDetector.getSystemInfo();

    // Show system info
    Terminal.showSystemInfo(systemInfo);

    // Show helpful error with suggestions
    const platform = systemInfo.os.toLowerCase();
    const suggestions: string[] = resolveFFmpegSuggestions(platform);

    Terminal.showError('No FFmpeg implementation found', suggestions);

    // Show installation commands
    Terminal.showInstallationCommands(systemInfo.os);

    throw new Error('FFmpeg setup required. Please follow the installation instructions above.');
  }

  /**
   * Check if we should show interactive setup (not in CI, has TTY, etc.)
   */
  private shouldShowInteractiveSetup(): boolean {
    // Don't show UI in CI environments
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      return false;
    }

    // Don't show UI if no TTY (non-interactive terminal)
    if (!process.stdout.isTTY) {
      return false;
    }

    return true;
  }

  isNodeEnvironment = () =>
    typeof globalThis.process !== 'undefined' &&
    typeof globalThis.process.versions.node === 'string';

  isBrowserEnvironment = () => typeof window !== 'undefined' && typeof document !== 'undefined';

  isReactNativeEnvironment = () => navigator.product === 'ReactNative';
}

export default PlatformBridge;
