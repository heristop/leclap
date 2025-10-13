import PinoLogAdapter from './logging/PinoLogAdapter';
import FFmpegNodeAdapter from './ffmpeg/FFmpegNodeAdapter';
import FFmpegStaticAdapter from './ffmpeg/FFmpegStaticAdapter';
import FFmpegWasmAdapter from './ffmpeg/FFmpegWasmAdapter';
import AbstractFFmpeg from './ffmpeg/AbstractFFmpeg';
import MusicNodeAdapter from './ffmpeg/MusicNodeAdapter';
import FilesystemNodeAdapter from './filesystem/FilesystemNodeAdapter';
import { FFmpegDetector, FFmpegAvailability } from './ffmpeg/FFmpegDetector';
import { TerminalUI } from '../utils/TerminalUI';
import pc from 'picocolors';

class PlatformBridge {
  private ffmpegAdapterCache: AbstractFFmpeg | null = null;
  private isFirstRun: boolean = true;

  create = async (adapter: string) => {
    if (false === ['logger', 'ffmpeg', 'filesystem', 'music'].includes(adapter)) {
      throw new TypeError(`Wrong adapter: ${adapter}`);
    }

    // Special handling for FFmpeg adapter with fallback logic
    if (adapter === 'ffmpeg') {
      return await this.createFFmpegAdapter();
    }

    // Handle other adapters
    let platform: string;

    if (this.isNodeEnvironment()) {
      platform = 'node';
    } else if (this.isBrowserEnvironment()) {
      platform = 'browser';
    } else if (this.isReactNativeEnvironment()) {
      platform = 'reactnative';
    } else {
      throw new Error('Unsupported platform');
    }

    const classesMapping = {
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

    const AdapterClass = classesMapping[adapter]?.[platform];
    if (!AdapterClass) {
      throw new Error(`No ${adapter} adapter available for platform: ${platform}`);
    }

    return new AdapterClass();
  };

  /**
   * Create FFmpeg adapter with intelligent fallback and pretty UI
   */
  private createFFmpegAdapter = async () => {
    // Return cached adapter if available
    if (this.ffmpegAdapterCache) {
      return this.ffmpegAdapterCache;
    }

    try {
      // Check if this is the first run and show interactive setup
      if (this.isFirstRun && this.shouldShowInteractiveSetup()) {
        console.log(pc.cyan('\n🎬 Welcome to FFmpeg Video Composer! 🎬\n'));

        TerminalUI.startSpinner('🔍 Detecting FFmpeg installations...');
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Add some suspense
      }

      const detection = await FFmpegDetector.detect();

      if (this.isFirstRun && this.shouldShowInteractiveSetup()) {
        TerminalUI.stopSpinner('success', 'Detection complete!');
      }

      let adapter;
      switch (detection.availability) {
        case FFmpegAvailability.SYSTEM: {
          if (this.shouldShowInteractiveSetup()) {
            console.log(
              `${pc.green('✅')} ${pc.bold('Perfect!')} Using system FFmpeg ${pc.dim(`(${detection.version})`)}`
            );
            console.log(`${pc.cyan('🚀')} ${pc.dim('Optimal performance expected!')}\n`);
          }
          adapter = new FFmpegNodeAdapter();
          break;
        }

        case FFmpegAvailability.STATIC: {
          if (this.shouldShowInteractiveSetup()) {
            console.log(
              `${pc.yellow('📦')} ${pc.bold('Good!')} Using static FFmpeg ${pc.dim(`(${detection.version})`)}`
            );
            console.log(`${pc.dim('💡 Consider installing system FFmpeg for better performance')}\n`);
          }
          adapter = new FFmpegStaticAdapter();
          break;
        }

        case FFmpegAvailability.WASM: {
          if (this.shouldShowInteractiveSetup()) {
            console.log(
              `${pc.magenta('🌐')} ${pc.bold('Browser mode!')} Using WebAssembly FFmpeg ${pc.dim(`(${detection.version})`)}`
            );
            console.log(`${pc.dim('⚠️ Limited to 2GB files and slower processing')}\n`);
          }
          adapter = new FFmpegWasmAdapter();
          break;
        }

        case FFmpegAvailability.NONE:
        default: {
          if (this.shouldShowInteractiveSetup()) {
            return await this.handleFirstRunSetup();
          } else {
            const errorMessage = `No FFmpeg implementation available. ${detection.error}\n\n${FFmpegDetector.getInstallationInstructions()}`;
            throw new Error(errorMessage);
          }
        }
      }

      // Cache the adapter for future use
      this.ffmpegAdapterCache = adapter;
      this.isFirstRun = false;
      return adapter;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during FFmpeg detection';

      if (this.shouldShowInteractiveSetup()) {
        TerminalUI.showError(message, [
          'Check FFmpeg installation',
          'Run diagnostic: pnpm diagnose',
          'Install static fallback: pnpm add ffmpeg-static',
        ]);
      } else {
        console.error('[PlatformBridge] FFmpeg adapter creation failed:', message);
      }

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
    TerminalUI.showSystemInfo(systemInfo);

    // Show helpful error with suggestions
    const platform = systemInfo.os.toLowerCase();
    let suggestions: string[] = [];

    if (platform.includes('darwin')) {
      suggestions = ['🍺 brew install ffmpeg (recommended)', '📦 pnpm add ffmpeg-static (quick setup)'];
    } else if (platform.includes('linux')) {
      suggestions = ['🐧 sudo apt install ffmpeg (Ubuntu/Debian)', '📦 pnpm add ffmpeg-static (quick setup)'];
    } else if (platform.includes('win32')) {
      suggestions = ['🪟 Download from https://ffmpeg.org/download.html', '📦 pnpm add ffmpeg-static (quick setup)'];
    } else {
      suggestions = ['📦 pnpm add ffmpeg-static (universal solution)'];
    }

    TerminalUI.showError('No FFmpeg implementation found', suggestions);

    // Show installation commands
    TerminalUI.showInstallationCommands(systemInfo.os);

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
    globalThis.process.versions != null &&
    globalThis.process.versions.node != null;

  isBrowserEnvironment = () => typeof window !== 'undefined' && typeof document !== 'undefined';

  isReactNativeEnvironment = () => typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

export default PlatformBridge;
