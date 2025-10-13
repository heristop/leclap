#!/usr/bin/env node

// Standalone compile script that uses the built version
// This avoids TypeScript path resolution issues

import { compile, loadConfig } from './dist/index.js';
import { TerminalUI } from './dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

const configFilePath = process.argv[2];

async function main(configFilePath) {
  try {
    if (!configFilePath) {
      console.error('Usage: pnpm compile <template.json>');
      process.exit(1);
    }

    // Show welcome banner for first-time users
    if (shouldShowWelcome()) {
      showWelcomeBanner();
    }

    // Load the template descriptor
    const templateDescriptor = await loadConfig(`${configFilePath}`);

    // Get absolute paths for proper configuration
    const cwd = process.cwd();
    const buildDir = path.resolve(cwd, 'build');
    const assetsDir = path.resolve(cwd, 'src/shared/assets');

    // Ensure build directory exists
    await fs.mkdir(buildDir, { recursive: true });

    // Set up configuration similar to the server implementation
    const projectConfig = {
      buildDir, // Use absolute path
      assetsDir, // Use absolute path
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

    // Call the compilation function with progress indicator
    console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}`);
    console.log(`${pc.dim('🎞️ Processing your video magic...')}\n`);

    const result = await compile(projectConfig, templateDescriptor);

    console.log(`\n${pc.green('✅')} ${pc.bold('🎉 Compilation completed successfully!')}`)

    return result;
  } catch (error) {
    console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);

    if (error instanceof Error) {
      // Check if it's an FFmpeg-related error
      if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
        console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

        TerminalUI.showError(error.message, [
          '🔧 Run diagnostics: pnpm diagnose',
          '📦 Quick fix: pnpm add ffmpeg-static',
          '🍺 macOS: brew install ffmpeg',
          '🐧 Linux: sudo apt install ffmpeg',
        ]);

        console.log(`\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('pnpm diagnose')} ${pc.dim('for detailed system analysis')}\n`);
      } else {
        console.error(`${pc.red('Error:')} ${error.message}`);
        if (error.stack) console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', String(error));
    }
    process.exit(1);
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
  (async () => {
    try {
      const result = await main(configFilePath);
      if (result) {
        console.log(`Compilation successful: ${result}`);
      } else {
        console.error('Compilation failed to produce output');
        process.exit(1);
      }
    } catch (error) {
      // Handle errors
      if (error instanceof Error) {
        console.error(error.name + ':', error.message);
        if (error.stack) console.error(error.stack);
      } else {
        console.error('Unknown error:', String(error));
      }
      process.exit(1);
    }
  })();
}