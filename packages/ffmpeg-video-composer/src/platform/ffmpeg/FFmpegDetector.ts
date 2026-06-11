import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { totalmem } from 'node:os';
import { Terminal } from '../../utils/terminal';

const execFileAsync = promisify(execFile);

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
    const systemResult = await this.detectSystemFFmpeg();

    if (systemResult.availability === FFmpegAvailability.SYSTEM) {
      return systemResult;
    }

    const staticResult = await this.detectStaticFFmpeg();

    if (staticResult.availability === FFmpegAvailability.STATIC) {
      return staticResult;
    }

    const wasmResult = await this.detectWasmFFmpeg();

    if (wasmResult.availability === FFmpegAvailability.WASM) {
      return wasmResult;
    }

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
      const { stdout } = await execFileAsync('ffmpeg', ['-version']);
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return { availability: FFmpegAvailability.SYSTEM, version, path: 'system' };
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
      const { default: ffmpegStatic } = await import('ffmpeg-static');

      if (!ffmpegStatic) {
        throw new Error('ffmpeg-static path is null');
      }

      const { stdout } = await execFileAsync(ffmpegStatic, ['-version']);
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return { availability: FFmpegAvailability.STATIC, version, path: ffmpegStatic };
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
      if (typeof window === 'undefined') {
        return {
          availability: FFmpegAvailability.NONE,
          error: 'WebAssembly FFmpeg only available in browser environments',
        };
      }

      await import('@ffmpeg/ffmpeg');

      return { availability: FFmpegAvailability.WASM, version: '0.12.x (WebAssembly)', path: 'wasm' };
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
        return 'To install FFmpeg on macOS:\n1. Using Homebrew: brew install ffmpeg\n2. Or download from: https://ffmpeg.org/download.html\n\nAlternatively, install ffmpeg-static as a fallback:\nnpm install ffmpeg-static\n';
      case 'linux':
        return 'To install FFmpeg on Linux:\n1. Ubuntu/Debian: sudo apt install ffmpeg\n2. CentOS/RHEL: sudo yum install ffmpeg\n3. Or download from: https://ffmpeg.org/download.html\n\nAlternatively, install ffmpeg-static as a fallback:\nnpm install ffmpeg-static\n';
      case 'win32':
        return 'To install FFmpeg on Windows:\n1. Download from: https://ffmpeg.org/download.html\n2. Add to your system PATH\n3. Or use package managers like Chocolatey: choco install ffmpeg\n\nAlternatively, install ffmpeg-static as a fallback:\nnpm install ffmpeg-static\n';
      default:
        return 'To install FFmpeg:\n1. Visit: https://ffmpeg.org/download.html\n2. Or install ffmpeg-static as a fallback: npm install ffmpeg-static\n';
    }
  }

  /**
   * Check if current environment is Node.js
   */
  static isNodeEnvironment(): boolean {
    return typeof globalThis.process !== 'undefined';
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
    return navigator.product === 'ReactNative';
  }

  /**
   * Detect package manager from npm_config_user_agent
   */
  private static detectPackageManager(): string {
    const userAgent = process.env.npm_config_user_agent;

    if (!userAgent) {
      return 'npm';
    }

    if (userAgent.includes('pnpm')) {
      return 'pnpm';
    }

    if (userAgent.includes('yarn')) {
      return 'yarn';
    }

    return 'npm';
  }

  /**
   * Get detailed system information
   */
  static getSystemInfo(): SystemInfo {
    return {
      os: `${process.platform} ${process.arch}`,
      arch: process.arch,
      nodeVersion: process.version,
      packageManager: this.detectPackageManager(),
      memoryGB: Math.round((totalmem() / 1024 / 1024 / 1024) * 100) / 100,
    };
  }

  /**
   * Try to import a module; returns true if successful
   */
  private static async canImport(specifier: string): Promise<boolean> {
    try {
      await import(specifier);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check which optional dependencies are installed
   */
  static async checkOptionalDependencies(): Promise<{
    ffmpegStatic: boolean;
    ffmpegWasm: boolean;
    ffmpegUtil: boolean;
  }> {
    const [ffmpegStatic, ffmpegWasm, ffmpegUtil] = await Promise.all([
      this.canImport('ffmpeg-static'),
      this.canImport('@ffmpeg/ffmpeg'),
      this.canImport('@ffmpeg/util'),
    ]);

    return { ffmpegStatic, ffmpegWasm, ffmpegUtil };
  }

  /**
   * Run full system diagnostics and display results
   */
  static async runFullDiagnostics(showUI = true): Promise<DiagnosticReport> {
    if (showUI) {
      Terminal.showWelcomeBanner();
      Terminal.startSpinner('🔍 Analyzing your system...');
    }

    const systemInfo = this.getSystemInfo();

    if (showUI) {
      Terminal.stopSpinner('success', 'System analysis complete!');
      Terminal.showSystemInfo(systemInfo);
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

    const recommendations = this.generateRecommendations(systemInfo, ffmpegStatus);

    return { systemInfo, ffmpegStatus, recommendations };
  }

  /**
   * Build OS-specific FFmpeg installation recommendation
   */
  private static getOsInstallRecommendation(os: string): string | null {
    if (os.includes('darwin')) {
      return '🍺 For macOS: Run "brew install ffmpeg" for best performance';
    }

    if (os.includes('linux')) {
      return '🐧 For Linux: Run "sudo apt install ffmpeg" (Ubuntu/Debian)';
    }

    if (os.includes('win32')) {
      return '🪟 For Windows: Install FFmpeg from https://ffmpeg.org/download.html';
    }

    return null;
  }

  /**
   * Add recommendations when no FFmpeg implementation is found
   */
  private static addNoFFmpegRecommendations(recommendations: string[], systemInfo: SystemInfo): void {
    recommendations.push('🚨 No FFmpeg found! You need at least one implementation to use this package.');

    const osRecommendation = this.getOsInstallRecommendation(systemInfo.os);

    if (osRecommendation !== null) {
      recommendations.push(osRecommendation);
    }

    recommendations.push('📦 Quick alternative: Run "pnpm add ffmpeg-static" for zero-config setup');
  }

  /**
   * Generate personalized recommendations based on system state
   */
  static generateRecommendations(systemInfo: SystemInfo, ffmpegStatus: DiagnosticReport['ffmpegStatus']): string[] {
    const recommendations: string[] = [];
    const hasAnyFFmpeg = ffmpegStatus.system.available || ffmpegStatus.static.available || ffmpegStatus.wasm.available;

    if (!hasAnyFFmpeg) {
      this.addNoFFmpegRecommendations(recommendations, systemInfo);
    }

    if (hasAnyFFmpeg && !ffmpegStatus.system.available && ffmpegStatus.static.available) {
      recommendations.push('⚡ Consider installing system FFmpeg for faster processing');
      recommendations.push('📦 Current static FFmpeg works great but is slower');
    }

    if (hasAnyFFmpeg && ffmpegStatus.system.available) {
      recommendations.push('🚀 Perfect! System FFmpeg detected - optimal performance expected');
    }

    if (systemInfo.memoryGB < 4) {
      recommendations.push('⚠️ Low memory detected - consider smaller video files or upgrade RAM');
    }

    if (systemInfo.memoryGB >= 16) {
      recommendations.push('💪 Excellent! Plenty of memory for large video processing');
    }

    const nodeVersionNumber = parseInt(systemInfo.nodeVersion.replace('v', '').split('.')[0] ?? '0', 10);

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
    const hasFFmpeg =
      report.ffmpegStatus.system.available ||
      report.ffmpegStatus.static.available ||
      report.ffmpegStatus.wasm.available;

    if (hasFFmpeg) {
      Terminal.showSuccess('Your system is ready for video magic! 🎉');

      return true;
    }

    Terminal.showInstallationOptions();
    Terminal.showInstallationCommands(report.systemInfo.os);

    return false;
  }
}
