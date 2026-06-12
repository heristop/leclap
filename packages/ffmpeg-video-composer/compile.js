#!/usr/bin/env node

// Standalone compile script that uses the built version
// This avoids TypeScript path resolution issues

import 'reflect-metadata';
import { compile, loadConfig, Terminal } from './dist/index.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

// Resolve bundled assets relative to this script so it works whether invoked from the
// repo root (`pnpm compile`) or from within the package.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const configFilePath = process.argv[2];

/**
 * Detect the FFmpeg binary managed by mise (see mise.toml) and prepend its
 * directory to PATH so the core's `ffmpeg`/`ffprobe` lookups resolve to it.
 * No-op when mise or its ffmpeg shim is unavailable.
 */
function ensureMiseFFmpeg() {
  try {
    const ffmpegPath = execFileSync('mise', ['which', 'ffmpeg'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!ffmpegPath) {
      return;
    }

    const binDir = path.dirname(ffmpegPath);
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;
    console.log(`${pc.magenta('🧰')} ${pc.dim('Using mise FFmpeg:')} ${ffmpegPath}`);
  } catch {
    // mise not installed or no ffmpeg tool configured — fall back to system/static.
  }
}

/**
 * Build the project configuration object
 */
function buildProjectConfig() {
  const cwd = process.cwd();
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = path.resolve(scriptDir, 'src/shared/assets');

  return {
    buildDir,
    assetsDir,
    fields: {
      form_1_name: 'Emily Parker',
      form_1_firstname: 'Emily',
      form_1_lastname: 'Parker',
      form_1_job: 'Frontend Developer',
      form_2_keyword1: 'php',
      form_2_keyword2: 'javascript',
      form_2_keyword3: 'typescript',
      form_2_keyword4: 'caffeine',
      form_3_keyword1: 'remote',
    },
  };
}

/**
 * Handle FFmpeg-related compilation errors
 */
function handleFFmpegError(error) {
  console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

  Terminal.showError(error.message, [
    '🔧 Run diagnostics: pnpm diagnose',
    '🧰 mise: mise install (provisions ffmpeg from mise.toml)',
    '📦 Quick fix: pnpm add ffmpeg-static',
    '🍺 macOS: brew install ffmpeg',
    '🐧 Linux: sudo apt install ffmpeg',
  ]);

  console.log(
    `\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('pnpm diagnose')} ${pc.dim('for detailed system analysis')}\n`
  );
  process.exit(1);
}

/**
 * Handle compilation errors
 */
function handleCompilationError(error) {
  console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);

  if (!(error instanceof Error)) {
    console.error('Unknown error:', String(error));
    process.exit(1);

    return;
  }

  if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
    handleFFmpegError(error);

    return;
  }

  console.error(`${pc.red('Error:')} ${error.message}`);

  if (error.stack) console.error(error.stack);
  process.exit(1);
}

async function main(filePath) {
  if (!filePath) {
    console.error('Usage: pnpm compile <template.json>');
    process.exit(1);
  }

  try {
    if (shouldShowWelcome()) {
      showWelcomeBanner();
    }

    ensureMiseFFmpeg();

    const templateDescriptor = await loadConfig(`${filePath}`);
    const projectConfig = buildProjectConfig();

    await fs.mkdir(projectConfig.buildDir, { recursive: true });

    console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}`);
    console.log(`${pc.dim('🎞️ Processing your video magic...')}\n`);

    const result = await compile(projectConfig, templateDescriptor);

    console.log(`\n${pc.green('✅')} ${pc.bold('🎉 Compilation completed successfully!')}`);

    return result;
  } catch (error) {
    handleCompilationError(error);

    throw error;
  }
}

/**
 * Check if we should show welcome banner
 */
function shouldShowWelcome() {
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
function showWelcomeBanner() {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')}`);
  console.log(pc.dim('✨ Creating video magic from templates...\n'));
}

if (configFilePath) {
  try {
    const result = await main(configFilePath);

    if (!result) {
      console.error('Compilation failed to produce output');
      process.exit(1);
    }

    console.log(`Compilation successful: ${result}`);
  } catch (error) {
    // Handle errors
    if (!(error instanceof Error)) {
      console.error('Unknown error:', String(error));
      process.exit(1);
    }

    console.error(error.name + ':', error.message);

    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}
