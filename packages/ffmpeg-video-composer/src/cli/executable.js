#!/usr/bin/env node

// Executable entry point for ffmpeg-video-composer
// This creates a standalone executable that includes Node.js runtime

import 'reflect-metadata';
import { compile, loadConfig, FFmpegDetector, Terminal } from '../../../../dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

const args = process.argv.slice(2);
const command = args[0];

/**
 * Print a bold section title.
 */
function printTitle(title) {
  console.log(`\n${pc.bold(pc.cyan(title))}\n`);
}

/**
 * Print a labelled block of text.
 */
function printBox(content, label) {
  console.log(pc.dim(`── ${label} ──`));
  console.log(content);
}

async function showHelp() {
  printTitle('LeClap');

  const helpText = `
${pc.cyan('🎬')} ${pc.bold('LeClap')} - Create videos from templates

${pc.bold('Usage:')}
  ${pc.green('leclap')} ${pc.yellow('<template.json>')}    Compile video from template
  ${pc.green('leclap')} ${pc.yellow('--diagnose')}         Run system diagnostics
  ${pc.green('leclap')} ${pc.yellow('--help')}             Show this help message
  ${pc.green('leclap')} ${pc.yellow('--version')}          Show version information

${pc.bold('Examples:')}
  ${pc.dim('# Compile a video from template')}
  ${pc.green('leclap')} ${pc.yellow('my-template.json')}

  ${pc.dim('# Check system setup')}
  ${pc.green('leclap')} ${pc.yellow('--diagnose')}

${pc.bold('Template Format:')}
  Templates are JSON files describing video composition.
  See: ${pc.blue('https://github.com/heristop/ffmpeg-video-composer')}

${pc.bold('FFmpeg Requirements:')}
  • System FFmpeg (best performance)
  • ffmpeg-static (fallback)
  • @ffmpeg/ffmpeg (browser/WASM)

  Run ${pc.yellow('--diagnose')} for detailed setup information.
`;

  printBox(helpText, '📖 Help & Usage');
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
    printTitle('FFmpeg Diagnostics');

    const report = await FFmpegDetector.runFullDiagnostics(true);

    // Show recommendations
    if (report.recommendations.length > 0) {
      const recommendationText = `
${pc.bold('🎯 Personalized Recommendations:')}

${report.recommendations.map((rec) => `  ${pc.cyan('•')} ${rec}`).join('\n')}
`;

      printBox(recommendationText, '💡 Suggestions');
    }

    // Show summary
    const hasFFmpeg = [
      report.ffmpegStatus.system.available,
      report.ffmpegStatus.static.available,
      report.ffmpegStatus.wasm.available,
    ].some(Boolean);

    if (hasFFmpeg) {
      Terminal.showSuccess('Your system is ready for video magic! 🎉');
    }

    if (!hasFFmpeg) {
      console.log(`\n${pc.yellow('⚠️')} ${pc.bold('Setup required before you can compile videos')}\n`);
    }
  } catch (error) {
    console.error('Diagnostics failed:', error.message);
    process.exit(1);
  }
}

function buildProjectConfig(cwd) {
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = path.resolve(cwd, 'assets');

  return {
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
}

function handleFFmpegError(error) {
  console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

  Terminal.showError(error.message, [
    '🔧 Run diagnostics: leclap --diagnose',
    '📦 Quick fix: npm install ffmpeg-static',
    '🍺 macOS: brew install ffmpeg',
    '🐧 Linux: sudo apt install ffmpeg',
  ]);

  console.log(
    `\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('leclap --diagnose')} ${pc.dim('for detailed system analysis')}\n`
  );
  process.exit(1);
}

async function validateAndLoadTemplate(templatePath) {
  if (!templatePath) {
    console.error(`${pc.red('Error:')} Template file path is required`);
    console.log(`${pc.dim('Usage:')} leclap ${pc.yellow('<template.json>')}`);
    console.log(`${pc.dim('Help:')} leclap ${pc.yellow('--help')}`);
    process.exit(1);
  }

  try {
    await fs.access(templatePath);
  } catch {
    console.error(`${pc.red('Error:')} Template file not found: ${templatePath}`);
    process.exit(1);
  }

  return loadConfig(templatePath);
}

async function runCompilation(templatePath) {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')}`);
  console.log(`${pc.dim('✨ Creating video magic from templates...')}\n`);

  const templateDescriptor = await validateAndLoadTemplate(templatePath);
  const projectConfig = buildProjectConfig(process.cwd());

  await fs.mkdir(projectConfig.buildDir, { recursive: true });

  console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}`);
  console.log(`${pc.dim('🎞️ Processing your video magic...')}\n`);

  const result = await compile(projectConfig, templateDescriptor);

  console.log(`\n${pc.green('✅')} ${pc.bold('🎉 Compilation completed successfully!')}`);

  if (result) {
    console.log(`${pc.dim('Output:')} ${result}`);
  }

  return result;
}

function handleCompileError(error) {
  if (!(error instanceof Error)) {
    console.error('Unknown error:', String(error));
    process.exit(1);
  }

  if (error.message.includes('FFmpeg') || error.message.includes('ffmpeg')) {
    handleFFmpegError(error);
  }

  console.error(`${pc.red('Error:')} ${error.message}`);

  if (error.stack) console.error(error.stack);
  process.exit(1);
}

async function compileVideo(templatePath) {
  try {
    return await runCompilation(templatePath);
  } catch (error) {
    console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);
    handleCompileError(error);

    return null;
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
        }

        await compileVideo(command);
        break;
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
