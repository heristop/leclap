#!/usr/bin/env node

// Standalone compile script against the built dist — avoids TS path resolution in the package.

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

// Prepend the mise-managed FFmpeg directory to PATH so the core's ffmpeg/ffprobe lookups resolve to it.
// No-op when mise or its ffmpeg shim is unavailable.
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
    console.log(pc.dim(`mise FFmpeg: ${ffmpegPath}`));
  } catch {
    // mise not installed or no ffmpeg tool configured — fall back to system/static.
  }
}

function buildProjectConfig() {
  const cwd = process.cwd();
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = path.resolve(scriptDir, '../leclap-creative-kit/src/library');

  // FVC_RENDER_CONCURRENCY overrides the parallel-render width (1 disables; useful for benching).
  const concurrency = process.env.FVC_RENDER_CONCURRENCY;

  return {
    buildDir,
    assetsDir,
    hardwareConfig: concurrency ? { maxRenderConcurrency: Number(concurrency) } : undefined,
  };
}

function handleFFmpegError(error: Error) {
  Terminal.showError(error.message, [
    'Run diagnostics: pnpm diagnose',
    'mise: mise install (provisions ffmpeg from mise.toml)',
    'Quick fix: pnpm add ffmpeg-static',
    'macOS: brew install ffmpeg',
    'Linux: sudo apt install ffmpeg',
  ]);
  process.exit(1);
}

function handleCompilationError(error: unknown) {
  console.log(`\n${pc.bold('Compilation failed')}`);

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

async function main(filePath: string | undefined) {
  if (!filePath) {
    console.error('Usage: pnpm compile <template.json>');
    process.exit(1);
  }

  try {
    if (shouldShowWelcome()) {
      showWelcomeBanner();
    }

    ensureMiseFFmpeg();

    const templateDescriptor = await loadConfig(filePath);
    const projectConfig = buildProjectConfig();

    await fs.mkdir(projectConfig.buildDir, { recursive: true });

    console.log(`${pc.bold('Starting compilation…')}\n`);

    const result = await compile(projectConfig, templateDescriptor);

    console.log(`\n${pc.green('✓')} Compilation complete`);

    return result;
  } catch (error) {
    handleCompilationError(error);

    throw error;
  }
}

// Skip the banner in CI and non-interactive terminals. FFMPEG_COMPOSER_SKIP_WELCOME suppresses it.
function shouldShowWelcome() {
  if (process.env.CI || !process.stdout.isTTY) {
    return false;
  }

  return !process.env.FFMPEG_COMPOSER_SKIP_WELCOME;
}

function showWelcomeBanner() {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer (by LeClap)')}`);
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
    if (!(error instanceof Error)) {
      console.error('Unknown error:', String(error));
      process.exit(1);
    }

    console.error(error.name + ':', error.message);

    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}
