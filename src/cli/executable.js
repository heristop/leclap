#!/usr/bin/env node

// Executable entry point for ffmpeg-video-composer
// This creates a standalone executable that includes Node.js runtime

import { compile, loadConfig, FFmpegDetector, TerminalUI } from '../dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

const args = process.argv.slice(2);
const command = args[0];

async function showHelp() {
  console.log(TerminalUI.createTitle('FFmpeg Video Composer'));

  const helpText = `
${pc.cyan('🎬')} ${pc.bold('FFmpeg Video Composer')} - Create videos from templates

${pc.bold('Usage:')}
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('<template.json>')}    Compile video from template
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('--diagnose')}         Run system diagnostics
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('--help')}             Show this help message
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('--version')}          Show version information

${pc.bold('Examples:')}
  ${pc.dim('# Compile a video from template')}
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('my-template.json')}

  ${pc.dim('# Check system setup')}
  ${pc.green('ffmpeg-video-composer')} ${pc.yellow('--diagnose')}

${pc.bold('Template Format:')}
  Templates are JSON files describing video composition.
  See: ${pc.blue('https://github.com/heristop/ffmpeg-video-composer')}

${pc.bold('FFmpeg Requirements:')}
  • System FFmpeg (best performance)
  • ffmpeg-static (fallback)
  • @ffmpeg/ffmpeg (browser/WASM)

  Run ${pc.yellow('--diagnose')} for detailed setup information.
`;

  console.log(TerminalUI.createBox(helpText, '📖 Help & Usage', 'info'));
}

async function showVersion() {
  // Read version from package.json
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(packageContent);

    console.log(`${pc.cyan('🎬')} ${pc.bold('FFmpeg Video Composer')} v${packageData.version}`);
    console.log(`${pc.dim('Author:')} ${packageData.author}`);
    console.log(`${pc.dim('License:')} ${packageData.license}`);
    console.log(`${pc.dim('Repository:')} ${packageData.repository.url}`);
  } catch {
    console.log(`${pc.cyan('🎬')} ${pc.bold('FFmpeg Video Composer')} v1.0.0`);
  }
}

async function runDiagnostics() {
  try {
    console.clear();
    console.log(TerminalUI.createTitle('FFmpeg Diagnostics'));

    const report = await FFmpegDetector.runFullDiagnostics(true);

    // Show recommendations
    if (report.recommendations.length > 0) {
      const recommendationText = `
${pc.bold('🎯 Personalized Recommendations:')}

${report.recommendations.map(rec => `  ${pc.cyan('•')} ${rec}`).join('\n')}
`;

      console.log(TerminalUI.createBox(recommendationText, '💡 Smart Suggestions', 'info'));
    }

    // Show summary
    const hasFFmpeg = report.ffmpegStatus.system.available ||
                     report.ffmpegStatus.static.available ||
                     report.ffmpegStatus.wasm.available;

    if (hasFFmpeg) {
      TerminalUI.showSuccess('Your system is ready for video magic! 🎉');
    } else {
      console.log(`\n${pc.yellow('⚠️')} ${pc.bold('Setup required before you can compile videos')}\n`);
    }
  } catch (error) {
    console.error('Diagnostics failed:', error.message);
    process.exit(1);
  }
}

async function compileVideo(templatePath) {
  try {
    if (!templatePath) {
      console.error(`${pc.red('Error:')} Template file path is required`);
      console.log(`${pc.dim('Usage:')} ffmpeg-video-composer ${pc.yellow('<template.json>')}`);
      console.log(`${pc.dim('Help:')} ffmpeg-video-composer ${pc.yellow('--help')}`);
      process.exit(1);
    }

    // Check if template file exists
    try {
      await fs.access(templatePath);
    } catch {
      console.error(`${pc.red('Error:')} Template file not found: ${templatePath}`);
      process.exit(1);
    }

    // Show welcome banner
    console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')}`);
    console.log(`${pc.dim('✨ Creating video magic from templates...')}\n`);

    // Load the template descriptor
    const templateDescriptor = await loadConfig(templatePath);

    // Get absolute paths for proper configuration
    const cwd = process.cwd();
    const buildDir = path.resolve(cwd, 'build');
    const assetsDir = path.resolve(cwd, 'assets');

    // Ensure build directory exists
    await fs.mkdir(buildDir, { recursive: true });

    // Set up configuration
    const projectConfig = {
      buildDir,
      assetsDir,
      fields: {
        form_1_firstname: 'Emily',
        form_1_lastname: 'Parker',
        form_1_job: 'Video Creator',
        form_2_keyword1: 'creativity',
        form_2_keyword2: 'innovation',
        form_2_keyword3: 'technology',
        form_2_keyword4: 'magic',
      },
    };

    // Call the compilation function
    console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}`);
    console.log(`${pc.dim('🎞️ Processing your video magic...')}\n`);

    const result = await compile(projectConfig, templateDescriptor);

    console.log(`\n${pc.green('✅')} ${pc.bold('🎉 Compilation completed successfully!')}`);

    if (result) {
      console.log(`${pc.dim('Output:')} ${result}`);
    }

    return result;
  } catch (error) {
    console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);

    if (error instanceof Error) {
      // Check if it's an FFmpeg-related error
      if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
        console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

        TerminalUI.showError(error.message, [
          '🔧 Run diagnostics: ffmpeg-video-composer --diagnose',
          '📦 Quick fix: npm install ffmpeg-static',
          '🍺 macOS: brew install ffmpeg',
          '🐧 Linux: sudo apt install ffmpeg',
        ]);

        console.log(`\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('ffmpeg-video-composer --diagnose')} ${pc.dim('for detailed system analysis')}\n`);
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

async function main() {
  try {
    // Handle command line arguments
    switch (command) {
      case '--help':
      case '-h':
        await showHelp();
        break;

      case '--version':
      case '-v':
        await showVersion();
        break;

      case '--diagnose':
      case '-d':
        await runDiagnostics();
        break;

      default:
        if (!command) {
          await showHelp();
          process.exit(1);
        } else {
          await compileVideo(command);
        }
        break;
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
