import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { compile, loadConfig, Terminal, type ProjectConfig, type TemplateDescriptor } from 'ffmpeg-video-composer';
import { resolveAssetsDir } from '../resolveAssetsDir.js';
import { setEngineLogLevel } from '../log.js';
import { success, fail } from '../ui.js';

function buildProjectConfig(cwd: string): ProjectConfig & { buildDir: string } {
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = resolveAssetsDir(cwd, path.dirname(fileURLToPath(import.meta.url)));

  return { buildDir, assetsDir, fields: {} };
}

async function validateAndLoadTemplate(templatePath: string): Promise<TemplateDescriptor> {
  try {
    await fs.access(templatePath);
  } catch {
    console.error(fail(`Template not found: ${pc.cyan(templatePath)}`));
    process.exit(1);
  }

  return loadConfig(templatePath);
}

function reportError(error: unknown): never {
  const err = error instanceof Error ? error : new Error(String(error));

  if (err.message.includes('FFmpeg') || err.message.includes('ffmpeg')) {
    Terminal.showError(err.message, [
      'Check your setup: leclap diagnose',
      'Install a static binary: npm i ffmpeg-static',
      'macOS: brew install ffmpeg  ·  Linux: sudo apt install ffmpeg',
    ]);
    process.exit(1);
  }

  console.error(fail(err.message));
  process.exit(1);
}

export const render = defineCommand({
  meta: { name: 'render', description: 'Compile a video from a template JSON' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
    verbose: { type: 'boolean', description: 'Show the underlying engine logs', default: false },
  },
  async run({ args }) {
    setEngineLogLevel(args.verbose ? 'info' : 'silent');

    const template = await validateAndLoadTemplate(args.template);
    const projectConfig = buildProjectConfig(process.cwd());
    await fs.mkdir(projectConfig.buildDir, { recursive: true });

    const label = `Rendering ${pc.cyan(path.basename(args.template))}…`;
    // A spinner only when interactive and quiet; otherwise a plain line (piped/CI) or the engine's
    // own logs (--verbose).
    const interactive = !args.verbose && process.stdout.isTTY;

    if (interactive) Terminal.startSpinner(label);

    if (!interactive && !args.verbose) console.log(label);

    const startedAt = Date.now();

    try {
      const result = await compile(projectConfig, template);

      if (!result) throw new Error('Compilation failed to produce output');

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

      if (interactive) Terminal.stopSpinner();

      console.log(success(`Rendered ${pc.dim('→')} ${result} ${pc.dim(`(${seconds}s)`)}`));
    } catch (error) {
      if (interactive) Terminal.stopSpinner('error');

      reportError(error);
    }
  },
});
