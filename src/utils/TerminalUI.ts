import pc from 'picocolors';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import cliSpinners from 'cli-spinners';

export class TerminalUI {
  private static spinnerFrames = cliSpinners.dots.frames;
  private static currentSpinner: ReturnType<typeof setInterval> | null = null;

  /**
   * Create colorful ASCII art title
   */
  static createTitle(text: string): string {
    try {
      const ascii = figlet.textSync(text, {
        font: 'Small',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      });
      return gradient.rainbow.multiline(ascii);
    } catch {
      // Fallback if figlet fails
      return gradient.rainbow(`🎬 ${text.toUpperCase()} 🎬`);
    }
  }

  /**
   * Create a styled box with content
   */
  static createBox(content: string, title?: string, style: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
    const colors = {
      info: { border: 'cyan', background: 'bgCyan' },
      success: { border: 'green', background: 'bgGreen' },
      warning: { border: 'yellow', background: 'bgYellow' },
      error: { border: 'red', background: 'bgRed' },
    };

    return boxen(content, {
      title,
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: colors[style].border as 'cyan' | 'green' | 'yellow' | 'red',
    });
  }

  /**
   * Show welcome banner with animation
   */
  static showWelcomeBanner(): void {
    console.clear();

    const title = this.createTitle('FFmpeg Video Composer');
    console.log(title);

    const welcomeText = `
${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')} ${pc.cyan('🎬')}

${pc.dim("Let's set up your video magic environment! ✨")}
`;

    console.log(this.createBox(welcomeText, '🎭 FIRST TIME SETUP 🎭', 'info'));
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
    const systemText = `
${pc.green('✅')} ${pc.bold('Operating System:')} ${info.os} ${this.getOSEmoji(info.os)}
${pc.green('✅')} ${pc.bold('Architecture:')} ${info.arch}
${pc.green('✅')} ${pc.bold('Node.js:')} ${info.nodeVersion} ${pc.dim('(Perfect! 🚀)')}
${pc.green('✅')} ${pc.bold('Package Manager:')} ${info.packageManager}
${pc.green('✅')} ${pc.bold('Memory:')} ${info.memoryGB}GB ${pc.dim('(Plenty for video magic! ✨)')}
`;

    console.log(this.createBox(systemText, '📊 Your Setup Report Card', 'info'));
  }

  /**
   * Show FFmpeg detection results with personality
   */
  static showFFmpegStatus(detection: {
    system: { available: boolean; version?: string };
    static: { available: boolean; version?: string };
    wasm: { available: boolean; version?: string };
  }): void {
    const statusLines = [
      `${this.getStatusIcon(detection.system.available)} ${pc.bold('System FFmpeg:')} ${this.getStatusText(detection.system.available, detection.system.version)}`,
      `${this.getStatusIcon(detection.static.available)} ${pc.bold('Static FFmpeg:')} ${this.getStatusText(detection.static.available, detection.static.version)}`,
      `${this.getStatusIcon(detection.wasm.available)} ${pc.bold('WASM FFmpeg:')} ${this.getStatusText(detection.wasm.available, detection.wasm.version)}`,
    ];

    const detectionText = `
🕵️ ${pc.bold('FFmpeg Detective Mode Activated!')}

${statusLines.join('\n')}
`;

    console.log(this.createBox(detectionText, '🔍 DETECTION RESULTS', 'info'));
  }

  /**
   * Show installation options with fun interface
   */
  static showInstallationOptions(): void {
    const optionsText = `
${pc.cyan('🎯')} ${pc.bold('Choose your adventure:')}

  ${pc.green('1️⃣')}  ${pc.bold('🚀 Quick Setup')} ${pc.dim('(auto-install ffmpeg-static)')}
  ${pc.blue('2️⃣')}  ${pc.bold('⚡ Pro Setup')} ${pc.dim('(install system FFmpeg)')}
  ${pc.magenta('3️⃣')}  ${pc.bold('🌐 Browser Mode')} ${pc.dim('(WebAssembly only)')}
  ${pc.yellow('4️⃣')}  ${pc.bold('🔧 Advanced Diagnostics')} ${pc.dim('(detailed system info)')}

${pc.dim('💡 Pro tip: Option 1 is perfect for getting started quickly!')}
`;

    console.log(this.createBox(optionsText, '🎪 Installation Circus', 'info'));
    process.stdout.write(`${pc.bold('👉 Your choice [1-4]:')} `);
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
    const errorText = `
${pc.red('😱 Oops! Something went wrong!')}

${pc.bold('🚨 ERROR:')} ${error}

${pc.cyan("🎯 BUT DON'T PANIC! 🎯")}
${pc.dim('I know exactly how to fix this!')}

${pc.bold('🔧 Quick fixes for you:')}
${suggestions.map((s) => `  ${pc.green('•')} ${s}`).join('\n')}

${pc.yellow('💡 Pro tip: I can do this for you! Just say yes! ✨')}
`;

    console.log(this.createBox(errorText, '🚨 Houston, We Have a Problem!', 'error'));
  }

  /**
   * Show success celebration
   */
  static showSuccess(message: string): void {
    const successText = `
${pc.green('🎉 TADA! SUCCESS! 🎉')}

${message}

${gradient.rainbow('🎊 Your video studio is ready! 🎊')}
`;

    console.log(this.createBox(successText, '🎪 Mission Accomplished!', 'success'));
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
  static async typeText(text: string, speed: number = 50): Promise<void> {
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

    const commandText = `
${pc.bold('🔧 Installation Commands for your platform:')}

${commands.map((cmd) => `  ${pc.cyan('$')} ${pc.green(cmd.command)}\n    ${pc.dim(cmd.description)}`).join('\n\n')}
`;

    console.log(this.createBox(commandText, `🛠️ ${platform} Setup Guide`, 'info'));
  }

  /**
   * Private helper methods
   */
  private static getStatusIcon(available: boolean): string {
    return available ? pc.green('✅') : pc.red('❌');
  }

  private static getStatusText(available: boolean, version?: string): string {
    if (available && version) {
      return pc.green(`Available (${version})`);
    } else if (available) {
      return pc.green('Available');
    } else {
      return pc.red('Not found');
    }
  }

  private static getOSEmoji(os: string): string {
    if (os.toLowerCase().includes('darwin') || os.toLowerCase().includes('mac')) return '🍎';
    if (os.toLowerCase().includes('linux')) return '🐧';
    if (os.toLowerCase().includes('windows')) return '🪟';
    return '💻';
  }

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
