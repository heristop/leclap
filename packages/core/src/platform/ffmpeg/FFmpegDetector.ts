import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Terminal } from '../../utils/terminal';

const execAsync = promisify(exec);

export enum FFmpegAvailability {
  SYSTEM = 'system',
  STATIC = 'static',
  WASM = 'wasm',
  NONE = 'none',
}

export interface FFmpegDetectionResult {
  availability: FFmpegAvailability;
  version?: string;
  path?: string;
  error?: string;
}

export interface SystemInfo {
  os: string;
  arch: string;
  nodeVersion: string;
  packageManager: string;
  memoryGB: number;
}

export interface DiagnosticReport {
  systemInfo: SystemInfo;
  ffmpegStatus: {
    system: { available: boolean; version?: string; error?: string };
    static: { available: boolean; version?: string; error?: string };
    wasm: { available: boolean; version?: string; error?: string };
  };
  recommendations: string[];
}

export class FFmpegDetector {
  /**
   * Detect available FFmpeg options in order of preference
   * @returns Detection result with best available option
   */
  static async detect(): Promise<FFmpegDetectionResult> {
    // Try system FFmpeg first (best performance)
    const systemResult = await this.detectSystemFFmpeg();
    if (systemResult.availability === FFmpegAvailability.SYSTEM) {
      return systemResult;
    }

    // Try static FFmpeg next (good fallback)
    const staticResult = await this.detectStaticFFmpeg();
    if (staticResult.availability === FFmpegAvailability.STATIC) {
      return staticResult;
    }

    // Try WebAssembly FFmpeg (browser/universal fallback)
    const wasmResult = await this.detectWasmFFmpeg();
    if (wasmResult.availability === FFmpegAvailability.WASM) {
      return wasmResult;
    }

    // No FFmpeg available
    return {
      availability: FFmpegAvailability.NONE,
      error:
        'No FFmpeg implementation found. Please install FFmpeg system-wide or ensure optional dependencies are installed.',
    };
  }

  /**
   * Check if system FFmpeg is available
   */
  static async detectSystemFFmpeg(): Promise<FFmpegDetectionResult> {
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        availability: FFmpegAvailability.SYSTEM,
        version,
        path: 'system',
      };
    } catch (error) {
      return {
        availability: FFmpegAvailability.NONE,
        error: `System FFmpeg not found: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if static FFmpeg is available
   */
  static async detectStaticFFmpeg(): Promise<FFmpegDetectionResult> {
    try {
      // Try to require ffmpeg-static
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegStatic = require('ffmpeg-static');

      if (!ffmpegStatic) {
        throw new Error('ffmpeg-static path is null');
      }

      // Test the static binary
      const { stdout } = await execAsync(`"${ffmpegStatic}" -version`);
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        availability: FFmpegAvailability.STATIC,
        version,
        path: ffmpegStatic,
      };
    } catch (error) {
      return {
        availability: FFmpegAvailability.NONE,
        error: `Static FFmpeg not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if WebAssembly FFmpeg is available
   */
  static async detectWasmFFmpeg(): Promise<FFmpegDetectionResult> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return {
          availability: FFmpegAvailability.NONE,
          error: 'WebAssembly FFmpeg only available in browser environments',
        };
      }

      // Try to import @ffmpeg/ffmpeg
      await import('@ffmpeg/ffmpeg');

      return {
        availability: FFmpegAvailability.WASM,
        version: '0.12.x (WebAssembly)',
        path: 'wasm',
      };
    } catch (error) {
      return {
        availability: FFmpegAvailability.NONE,
        error: `WebAssembly FFmpeg not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get installation instructions based on platform
   */
  static getInstallationInstructions(): string {
    const platform = process.platform;

    switch (platform) {
      case 'darwin':
        return `
To install FFmpeg on macOS:
1. Using Homebrew: brew install ffmpeg
2. Or download from: https://ffmpeg.org/download.html

Alternatively, install ffmpeg-static as a fallback:
npm install ffmpeg-static
`;

      case 'linux':
        return `
To install FFmpeg on Linux:
1. Ubuntu/Debian: sudo apt install ffmpeg
2. CentOS/RHEL: sudo yum install ffmpeg
3. Or download from: https://ffmpeg.org/download.html

Alternatively, install ffmpeg-static as a fallback:
npm install ffmpeg-static
`;

      case 'win32':
        return `
To install FFmpeg on Windows:
1. Download from: https://ffmpeg.org/download.html
2. Add to your system PATH
3. Or use package managers like Chocolatey: choco install ffmpeg

Alternatively, install ffmpeg-static as a fallback:
npm install ffmpeg-static
`;

      default:
        return `
To install FFmpeg:
1. Visit: https://ffmpeg.org/download.html
2. Or install ffmpeg-static as a fallback: npm install ffmpeg-static
`;
    }
  }

  /**
   * Check if current environment is Node.js
   */
  static isNodeEnvironment(): boolean {
    return (
      typeof globalThis.process !== 'undefined' &&
      globalThis.process.versions !== null &&
      globalThis.process.versions.node !== null
    );
  }

  /**
   * Check if current environment is browser
   */
  static isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Check if current environment is React Native
   */
  static isReactNativeEnvironment(): boolean {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  }

  /**
   * Get detailed system information
   */
  static getSystemInfo(): SystemInfo {
    const os = `${process.platform} ${process.arch}`;
    const nodeVersion = process.version;
    const memoryGB = Math.round((process.memoryUsage().rss / 1024 / 1024 / 1024) * 100) / 100;

    // Detect package manager
    let packageManager = 'npm';
    if (process.env.npm_config_user_agent) {
      if (process.env.npm_config_user_agent.includes('pnpm')) packageManager = 'pnpm';
      else if (process.env.npm_config_user_agent.includes('yarn')) packageManager = 'yarn';
    }

    return {
      os,
      arch: process.arch,
      nodeVersion,
      packageManager,
      memoryGB,
    };
  }

  /**
   * Check which optional dependencies are installed
   */
  static async checkOptionalDependencies(): Promise<{
    ffmpegStatic: boolean;
    ffmpegWasm: boolean;
    ffmpegUtil: boolean;
  }> {
    const checks = {
      ffmpegStatic: false,
      ffmpegWasm: false,
      ffmpegUtil: false,
    };

    try {
      require.resolve('ffmpeg-static');
      checks.ffmpegStatic = true;
    } catch {
      // Not installed
    }

    try {
      require.resolve('@ffmpeg/ffmpeg');
      checks.ffmpegWasm = true;
    } catch {
      // Not installed
    }

    try {
      require.resolve('@ffmpeg/util');
      checks.ffmpegUtil = true;
    } catch {
      // Not installed
    }

    return checks;
  }

  /**
   * Run full system diagnostics and display results
   */
  static async runFullDiagnostics(showUI = true): Promise<DiagnosticReport> {
    if (showUI) {
      Terminal.showWelcomeBanner();
      Terminal.startSpinner('🔍 Analyzing your system...');
    }

    // Get system info
    const systemInfo = this.getSystemInfo();

    if (showUI) {
      Terminal.stopSpinner('success', 'System analysis complete!');
      Terminal.showSystemInfo(systemInfo);
    }

    // Check all FFmpeg implementations
    if (showUI) {
      Terminal.startSpinner('🕵️ Detecting FFmpeg implementations...');
    }

    const [systemResult, staticResult, wasmResult] = await Promise.all([
      this.detectSystemFFmpeg(),
      this.detectStaticFFmpeg(),
      this.detectWasmFFmpeg(),
    ]);

    const ffmpegStatus = {
      system: {
        available: systemResult.availability === FFmpegAvailability.SYSTEM,
        version: systemResult.version,
        error: systemResult.error,
      },
      static: {
        available: staticResult.availability === FFmpegAvailability.STATIC,
        version: staticResult.version,
        error: staticResult.error,
      },
      wasm: {
        available: wasmResult.availability === FFmpegAvailability.WASM,
        version: wasmResult.version,
        error: wasmResult.error,
      },
    };

    if (showUI) {
      Terminal.stopSpinner('success', 'FFmpeg detection complete!');
      Terminal.showFFmpegStatus(ffmpegStatus);
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(systemInfo, ffmpegStatus);

    const report: DiagnosticReport = {
      systemInfo,
      ffmpegStatus,
      recommendations,
    };

    return report;
  }

  /**
   * Generate personalized recommendations based on system state
   */
  static generateRecommendations(systemInfo: SystemInfo, ffmpegStatus: DiagnosticReport['ffmpegStatus']): string[] {
    const recommendations: string[] = [];

    // Check if any FFmpeg is available
    const hasAnyFFmpeg = ffmpegStatus.system.available || ffmpegStatus.static.available || ffmpegStatus.wasm.available;

    if (!hasAnyFFmpeg) {
      recommendations.push('🚨 No FFmpeg found! You need at least one implementation to use this package.');

      // Platform-specific recommendations
      if (systemInfo.os.includes('darwin')) {
        recommendations.push('🍺 For macOS: Run "brew install ffmpeg" for best performance');
      } else if (systemInfo.os.includes('linux')) {
        recommendations.push('🐧 For Linux: Run "sudo apt install ffmpeg" (Ubuntu/Debian)');
      } else if (systemInfo.os.includes('win32')) {
        recommendations.push('🪟 For Windows: Install FFmpeg from https://ffmpeg.org/download.html');
      }

      recommendations.push('📦 Quick alternative: Run "pnpm add ffmpeg-static" for zero-config setup');
    } else if (!ffmpegStatus.system.available && ffmpegStatus.static.available) {
      recommendations.push('⚡ Consider installing system FFmpeg for faster processing');
      recommendations.push('📦 Current static FFmpeg works great but is slower');
    } else if (ffmpegStatus.system.available) {
      recommendations.push('🚀 Perfect! System FFmpeg detected - optimal performance expected');
    }

    // Memory recommendations
    if (systemInfo.memoryGB < 4) {
      recommendations.push('⚠️ Low memory detected - consider smaller video files or upgrade RAM');
    } else if (systemInfo.memoryGB >= 16) {
      recommendations.push('💪 Excellent! Plenty of memory for large video processing');
    }

    // Node.js version check
    const nodeVersionNumber = parseInt(systemInfo.nodeVersion.replace('v', '').split('.')[0]);
    if (nodeVersionNumber < 22) {
      recommendations.push('🔄 Consider upgrading to Node.js 22+ for optimal performance');
    }

    return recommendations;
  }

  /**
   * Interactive first-run setup
   */
  static async runInteractiveSetup(): Promise<boolean> {
    const report = await this.runFullDiagnostics(true);

    // If FFmpeg is available, we're good to go
    const hasFFmpeg =
      report.ffmpegStatus.system.available ||
      report.ffmpegStatus.static.available ||
      report.ffmpegStatus.wasm.available;

    if (hasFFmpeg) {
      Terminal.showSuccess('Your system is ready for video magic! 🎉');
      return true;
    }

    // Show installation options
    Terminal.showInstallationOptions();

    // In a real implementation, you'd handle user input here
    // For now, we'll show the platform-specific commands
    Terminal.showInstallationCommands(report.systemInfo.os);

    return false;
  }
}
