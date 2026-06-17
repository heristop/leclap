import { compile, loadConfig } from '.';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Terminal } from './utils/terminal';
import pc from 'picocolors';

const configFilePath = globalThis.process.argv[2];

function buildProjectConfig(): { buildDir: string; assetsDir: string } {
  const cwd = process.cwd();
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = path.resolve(cwd, 'packages/leclap-creative-kit/src/library');

  return {
    buildDir,
    assetsDir,
  };
}

function handleCompilationError(error: Error): never {
  Terminal.stopSpinner('error', 'Compilation failed');

  if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
    console.log(`\n${pc.bold('FFmpeg Issue Detected')}\n`);

    Terminal.showError(error.message, [
      'Run diagnostics: pnpm diagnose',
      'Quick fix: pnpm add ffmpeg-static',
      'macOS: brew install ffmpeg',
      'Linux: sudo apt install ffmpeg',
    ]);
    process.exit(1);
  }

  console.error(`${pc.red('Error:')} ${error.message}`);

  if (error.stack) console.error(error.stack);
  process.exit(1);
}

async function main(configFilePath: string): Promise<string | null> {
  if (shouldShowWelcome()) {
    showWelcomeBanner();
  }

  const templateDescriptor = await loadConfig(configFilePath);
  const projectConfig = buildProjectConfig();
  await fs.mkdir(projectConfig.buildDir, { recursive: true });

  console.log(`${pc.bold('Starting video compilation...')}\n`);

  Terminal.startSpinner('Processing…');

  try {
    const result = await compile(projectConfig, templateDescriptor);
    Terminal.stopSpinner('success', 'Compilation complete');

    return result;
  } catch (error) {
    if (!(error instanceof Error)) {
      Terminal.stopSpinner('error', 'Compilation failed');
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
  try {
    await runMain(configFilePath);
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error('Unknown error:', String(error));
      process.exit(1);
    }

    console.error(error.name + ':', error.message);

    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Skip the banner in CI and non-interactive terminals. FFMPEG_COMPOSER_SKIP_WELCOME suppresses it.
function shouldShowWelcome(): boolean {
  if (process.env.CI || !process.stdout.isTTY) {
    return false;
  }

  return !process.env.FFMPEG_COMPOSER_SKIP_WELCOME;
}

function showWelcomeBanner(): void {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer (by LeClap)')}`);
}

export { main };
