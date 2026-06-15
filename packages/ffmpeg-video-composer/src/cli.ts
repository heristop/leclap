// CLI entry point for ffmpeg-video-composer, built by tsdown into dist/cli.js
// (shebang added via the tsdown `banner` option).

import 'reflect-metadata';
import { compile, loadConfig, FFmpegDetector, Terminal } from './index';
import type { ProjectConfig, TemplateDescriptor } from './core/types';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { resolveAssetsDir } from './cli/resolveAssetsDir';

const args = process.argv.slice(2);
const command = args[0];

function printTitle(title: string): void {
  console.log(`\n${pc.bold(pc.cyan(title))}\n`);
}

function printBox(content: string, label: string): void {
  console.log(pc.dim(`── ${label} ──`));
  console.log(content);
}

function showHelp(): void {
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

async function showVersion(): Promise<void> {
  // Resolve the package's own package.json relative to this module (dist/cli.js
  // in the published layout), not the consumer's cwd.
  try {
    const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
    const packageContent = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(packageContent) as {
      version: string;
      author: string;
      license: string;
      repository: { url: string };
    };

    console.log(`${pc.cyan('🎬')} ${pc.bold('FFmpeg Video Composer')} v${packageData.version}`);
    console.log(`${pc.dim('Author:')} ${packageData.author}`);
    console.log(`${pc.dim('License:')} ${packageData.license}`);
    console.log(`${pc.dim('Repository:')} ${packageData.repository.url}`);
  } catch {
    console.log(`${pc.cyan('🎬')} ${pc.bold('FFmpeg Video Composer')}`);
  }
}

async function runDiagnostics(): Promise<void> {
  try {
    console.clear();
    printTitle('FFmpeg Diagnostics');

    const report = await FFmpegDetector.runFullDiagnostics(true);

    if (report.recommendations.length > 0) {
      const recommendationText = `
${pc.bold('🎯 Personalized Recommendations:')}

${report.recommendations.map((rec) => `  ${pc.cyan('•')} ${rec}`).join('\n')}
`;

      printBox(recommendationText, '💡 Suggestions');
    }

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
    console.error('Diagnostics failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function buildProjectConfig(cwd: string): ProjectConfig & { buildDir: string } {
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = resolveAssetsDir(cwd, path.dirname(fileURLToPath(import.meta.url)));

  return {
    buildDir,
    assetsDir,
    fields: {},
  };
}

function handleFFmpegError(error: Error): never {
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

async function validateAndLoadTemplate(templatePath: string | undefined): Promise<TemplateDescriptor> {
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

async function runCompilation(templatePath: string): Promise<unknown> {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to FFmpeg Video Composer!')}`);
  console.log(`${pc.dim('✨ Creating video magic from templates...')}\n`);

  const templateDescriptor = await validateAndLoadTemplate(templatePath);
  const projectConfig = buildProjectConfig(process.cwd());

  await fs.mkdir(projectConfig.buildDir, { recursive: true });

  console.log(`${pc.cyan('🎬')} ${pc.bold('Starting video compilation...')}`);
  console.log(`${pc.dim('🎞️ Processing your video magic...')}\n`);

  const result = await compile(projectConfig, templateDescriptor);

  if (!result) {
    throw new Error('Compilation failed to produce output');
  }

  console.log(`\n${pc.green('✅')} ${pc.bold('🎉 Compilation completed successfully!')}`);
  console.log(`${pc.dim('Output:')} ${result}`);

  return result;
}

function handleCompileError(error: unknown): never {
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

async function compileVideo(templatePath: string): Promise<void> {
  try {
    await runCompilation(templatePath);
  } catch (error) {
    console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);
    handleCompileError(error);
  }
}

async function main(): Promise<void> {
  try {
    switch (command) {
      case '--help':
      case '-h':
        showHelp();
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
          showHelp();
          process.exit(1);
        }

        await compileVideo(command);
        break;
    }
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
