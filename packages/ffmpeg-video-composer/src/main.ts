import { compile, loadConfig } from '.';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Terminal } from './utils/terminal';
import pc from 'picocolors';

const configFilePath = globalThis.process.argv[2];

function buildProjectConfig(): { buildDir: string; assetsDir: string; fields: Record<string, string> } {
  const cwd = process.cwd();
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = path.resolve(cwd, 'packages/core/src/shared/assets');

  return {
    buildDir,
    assetsDir,
    fields: {
      form_1_firstname: 'Emily',
      form_1_lastname: 'Parker',
      form_1_job: 'Frontend Developer',
      form_2_keyword1: 'php',
      form_2_keyword2: 'javascript',
      form_2_keyword3: 'typescript',
      form_2_keyword4: 'caffeine',
    },
  };
}

function handleCompilationError(error: Error): never {
  Terminal.stopSpinner('error', '❌ Compilation failed');

  // Check if it's an FFmpeg-related error
  if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
    console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

    Terminal.showError(error.message, [
      '🔧 Run diagnostics: pnpm diagnose',
      '📦 Quick fix: pnpm add ffmpeg-static',
      '🍺 macOS: brew install ffmpeg',
      '🐧 Linux: sudo apt install ffmpeg',
    ]);

    console.log(
      `\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('pnpm diagnose')} ${pc.dim('for detailed system analysis')}\n`
    );
    process.exit(1);
  }

  console.error(`${pc.red('Error:')} ${error.message}`);

  if (error.stack) console.error(error.stack);
  process.exit(1);
}

async function main(configFilePath: string): Promise<string | null> {
  // Show welcome banner for first-time users
  if (shouldShowWelcome()) {
    showWelcomeBanner();
  }

  // Load the template descriptor
  const templateDescriptor = await loadConfig(configFilePath);

  // Ensure build directory exists
  const projectConfig = buildProjectConfig();
  await fs.mkdir(projectConfig.buildDir, { recursive: true });

  // Call the compilation function with progress indicator
  console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}\n`);

  Terminal.startSpinner('🎞️ Processing your video magic...');

  try {
    const result = await compile(projectConfig, templateDescriptor);
    Terminal.stopSpinner('success', '🎉 Compilation completed successfully!');

    return result;
  } catch (error) {
    if (!(error instanceof Error)) {
      Terminal.stopSpinner('error', '❌ Compilation failed');
      console.error('Unknown error:', String(error));
      process.exit(1);
    }
    handleCompilationError(error);
  }

  return null;
}

async function runMain(filePath: string): Promise<void> {
  const result = await main(filePath);

  if (!result) {
    console.error('Compilation failed to produce output');
    process.exit(1);
  }

  console.log(`Compilation successful: ${result}`);
}

if (configFilePath) {
  runMain(configFilePath).catch((error: unknown) => {
    if (!(error instanceof Error)) {
      console.error('Unknown error:', String(error));
      process.exit(1);
    }

    console.error(error.name + ':', error.message);

    if (error.stack) console.error(error.stack);
    process.exit(1);
  });
}

/**
 * Check if we should show welcome banner
 */
function shouldShowWelcome(): boolean {
  // Don't show in CI or non-interactive terminals
  if (process.env.CI || !process.stdout.isTTY) {
    return false;
  }

  // Show welcome if it looks like a first run
  return !process.env.FFMPEG_COMPOSER_SKIP_WELCOME;
}

/**
 * Show welcome banner for first-time users
 */
function showWelcomeBanner(): void {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')}`);
  console.log(pc.dim('✨ Creating video magic from templates...\n'));
}

export { main };
