import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { compile, loadConfig, Terminal, type ProjectConfig, type TemplateDescriptor } from 'ffmpeg-video-composer';
import { resolveAssetsDir } from '../resolveAssetsDir.js';

function buildProjectConfig(cwd: string): ProjectConfig & { buildDir: string } {
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = resolveAssetsDir(cwd, path.dirname(fileURLToPath(import.meta.url)));

  return { buildDir, assetsDir, fields: {} };
}

function handleFFmpegError(error: Error): never {
  console.log(`\n${pc.red('😱')} ${pc.bold('FFmpeg Issue Detected!')}\n`);

  Terminal.showError(error.message, [
    '🔧 Run diagnostics: leclap diagnose',
    '📦 Quick fix: npm install ffmpeg-static',
    '🍺 macOS: brew install ffmpeg',
    '🐧 Linux: sudo apt install ffmpeg',
  ]);

  console.log(
    `\n${pc.yellow('💡')} ${pc.dim('Tip: Run')} ${pc.bold('leclap diagnose')} ${pc.dim('for detailed system analysis')}\n`
  );
  process.exit(1);
}

async function validateAndLoadTemplate(templatePath: string): Promise<TemplateDescriptor> {
  try {
    await fs.access(templatePath);
  } catch {
    console.error(`${pc.red('Error:')} Template file not found: ${templatePath}`);
    process.exit(1);
  }

  return loadConfig(templatePath);
}

async function runCompilation(templatePath: string): Promise<unknown> {
  console.log(`\n${pc.cyan('🎬')} ${pc.bold('Welcome to LeClap!')}`);
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

export const render = defineCommand({
  meta: { name: 'render', description: 'Compile a video from a JSON template' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
  },
  async run({ args }) {
    try {
      await runCompilation(args.template);
    } catch (error) {
      console.log(`\n${pc.red('❌')} ${pc.bold('Compilation failed')}`);
      handleCompileError(error);
    }
  },
});
