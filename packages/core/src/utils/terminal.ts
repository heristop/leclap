import pc from 'picocolors';

export class Terminal {
  private static spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private static currentSpinner: ReturnType<typeof setInterval> | null = null;

  /**
   * Show welcome banner
   */
  static showWelcomeBanner(): void {
    console.clear();
    console.log(pc.bold(pc.cyan('\n🎬 FFmpeg Video Composer\n')));
    console.log(pc.dim('Setting up your environment...\n'));
  }

  /**
   * Show system information in a fun way
   */
  static showSystemInfo(info: {
    os: string;
    arch: string;
    nodeVersion: string;
    packageManager: string;
    memoryGB: number;
  }): void {
    const row = `${pc.dim('OS')} ${info.os} ${info.arch}  ${pc.dim('Node')} ${info.nodeVersion}  ${pc.dim('PM')} ${info.packageManager}  ${pc.dim('RAM')} ${info.memoryGB}GB`;
    console.log(row);
  }

  /**
   * Show FFmpeg detection results with personality
   */
  static showFFmpegStatus(detection: {
    system: { available: boolean; version?: string };
    static: { available: boolean; version?: string };
    wasm: { available: boolean; version?: string };
  }): void {
    const formatShort = (info: { available: boolean; version?: string }) =>
      info.available ? pc.green('✓') : pc.dim('✗');
    const row = `${pc.dim('FFmpeg')} ${formatShort(detection.system)} sys ${detection.system.version || ''}  ${formatShort(detection.static)} static  ${formatShort(detection.wasm)} wasm`;
    console.log(row);
  }

  /**
   * Show installation options
   */
  static showInstallationOptions(): void {
    console.log(pc.bold('\nSetup Options:\n'));
    console.log(`  ${pc.green('1')} Quick Setup ${pc.dim('(auto-install ffmpeg-static)')}`);
    console.log(`  ${pc.blue('2')} Pro Setup ${pc.dim('(install system FFmpeg)')}`);
    console.log(`  ${pc.magenta('3')} Browser Mode ${pc.dim('(WebAssembly only)')}`);
    console.log(`  ${pc.yellow('4')} Advanced Diagnostics ${pc.dim('(detailed system info)')}`);
    process.stdout.write(`\n${pc.bold('Choice [1-4]:')} `);
  }

  /**
   * Show progress with animated spinner
   */
  static startSpinner(message: string): void {
    this.stopSpinner();
    let frame = 0;

    process.stdout.write(`${message} `);

    this.currentSpinner = setInterval(() => {
      process.stdout.write(`\r${message} ${pc.cyan(this.spinnerFrames[frame])} `);
      frame = (frame + 1) % this.spinnerFrames.length;
    }, 80);
  }

  /**
   * Stop the spinner and show result
   */
  static stopSpinner(result?: 'success' | 'error', message?: string): void {
    if (this.currentSpinner) {
      clearInterval(this.currentSpinner);
      this.currentSpinner = null;
    }

    if (result && message) {
      const icon = result === 'success' ? pc.green('✅') : pc.red('❌');
      console.log(`\r${icon} ${message}`);
    } else if (message) {
      console.log(`\r${message}`);
    }
  }

  /**
   * Show error with helpful suggestions
   */
  static showError(error: string, suggestions: string[]): void {
    console.log(pc.red(`\n✗ Error: ${error}\n`));
    if (suggestions.length > 0) {
      console.log(pc.bold('Suggestions:'));
      suggestions.forEach(s => console.log(`  • ${s}`));
      console.log();
    }
  }

  /**
   * Show success message
   */
  static showSuccess(message: string): void {
    console.log(pc.green(`\n✓ ${message}\n`));
  }

  /**
   * Show progress bar for installations
   */
  static showProgressBar(current: number, total: number, label: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((barLength * current) / total);

    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    const progressLine = `${label} [${pc.cyan(bar)}] ${percentage}%`;

    process.stdout.write(`\r${progressLine}`);

    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Show typing animation effect
   */
  static async typeText(text: string, speed = 50): Promise<void> {
    for (const char of text) {
      process.stdout.write(char);
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
    console.log(); // New line at end
  }

  /**
   * Show platform-specific installation commands
   */
  static showInstallationCommands(platform: string): void {
    const commands = this.getInstallationCommands(platform);
    console.log(pc.bold(`\n${platform} Installation:\n`));
    commands.forEach(cmd => {
      console.log(`  ${pc.cyan('$')} ${pc.green(cmd.command)}`);
      console.log(`    ${pc.dim(cmd.description)}\n`);
    });
  }

  /**
   * Private helper methods
   */
  private static getInstallationCommands(platform: string): Array<{ command: string; description: string }> {
    const os = platform.toLowerCase();

    if (os.includes('darwin') || os.includes('mac')) {
      return [
        { command: 'brew install ffmpeg', description: 'Install via Homebrew (recommended)' },
        { command: 'pnpm add ffmpeg-static', description: 'Or use static binary fallback' },
      ];
    } else if (os.includes('linux')) {
      return [
        { command: 'sudo apt install ffmpeg', description: 'Ubuntu/Debian systems' },
        { command: 'sudo dnf install ffmpeg', description: 'Fedora/RHEL systems' },
        { command: 'pnpm add ffmpeg-static', description: 'Or use static binary fallback' },
      ];
    } else if (os.includes('windows')) {
      return [
        { command: 'choco install ffmpeg', description: 'Install via Chocolatey' },
        { command: 'winget install ffmpeg', description: 'Install via Windows Package Manager' },
        { command: 'pnpm add ffmpeg-static', description: 'Or use static binary fallback' },
      ];
    } else {
      return [{ command: 'pnpm add ffmpeg-static', description: 'Universal static binary solution' }];
    }
  }

  /**
   * Create a fun loading sequence with messages
   */
  static async showLoadingSequence(steps: string[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      this.startSpinner(steps[i]);

      // Simulate work with random delay
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

      this.stopSpinner('success', steps[i]);

      if (i < steps.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
}
