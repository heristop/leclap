import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import {
  compile,
  loadConfig,
  FFmpegDetector,
  FFmpegAvailability,
  type CompileReporter,
  type ProjectConfig,
  type TemplateDescriptor,
} from 'ffmpeg-video-composer';
import { resolveAssetsDir } from '../resolveAssetsDir.js';
import { setEngineLogLevel } from '../log.js';
import { LiveRenderer } from '../render-progress.js';
import { success, fail, hint, step } from '../ui.js';
import { wordmark, statusRow, ok, bad, dot } from '../theme.js';

function buildProjectConfig(cwd: string): ProjectConfig & { buildDir: string } {
  const buildDir = path.resolve(cwd, 'build');
  const assetsDir = resolveAssetsDir(cwd);

  return { buildDir, assetsDir, fields: {} };
}

async function validateAndLoadTemplate(templatePath: string): Promise<TemplateDescriptor> {
  try {
    await fs.access(templatePath);
  } catch {
    console.error(fail(`Template not found: ${pc.bold(templatePath)}`));
    process.exit(1);
  }

  return loadConfig(templatePath);
}

function reportError(error: unknown): never {
  const err = error instanceof Error ? error : new Error(String(error));

  console.error(`\n${fail(err.message.trim())}`);

  if (err.message.includes('FFmpeg') || err.message.includes('ffmpeg')) {
    console.error(hint('  try'));
    console.error(step('leclap diagnose'));
    console.error(step('npm i ffmpeg-static  (bundled fallback)'));
    console.error(step('macOS: brew install ffmpeg  ·  Linux: sudo apt install ffmpeg'));
  }

  process.exit(1);
}

// Human-readable byte size, e.g. 1.4 MB. Best-effort; a stat failure yields an empty string so the
// summary still renders.
function prettySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

// The one-line render result: a cwd-relative output path (the absolute path is long and noisy) with the
// file size and elapsed time as a dim trailing aside.
function summaryLine(outputPath: string, startedAt: number, cwd: string): string {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const rel = path.relative(cwd, outputPath) || outputPath;

  let size = '';

  try {
    size = `${prettySize(statSync(outputPath).size)}  ${dot}  `;
  } catch {
    // Stat is decorative; omit the size if the file can't be measured.
  }

  return success(`Rendered ${pc.dim('→')} ${pc.bold(rel)}  ${pc.dim(`${size}${seconds}s`)}`);
}

export const render = defineCommand({
  meta: { name: 'render', description: 'Compile a video from a template JSON' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
    verbose: { type: 'boolean', description: 'Stream the underlying engine logs', default: false },
  },
  async run({ args }) {
    // --verbose streams the engine's own logs straight to stdout (no capture, no live region).
    // Otherwise the CLI owns the terminal: the engine stays silent on stdout and we tee its logs into a
    // file + a live progress region via the reporter.
    setEngineLogLevel(args.verbose ? 'info' : 'silent');
    // Take the terminal from the engine: it would otherwise print its own (mis-ordered) welcome banner
    // and detection rows during compile(). We render a single branded header here instead.
    process.env.LECLAP_CLI_UI = '1';

    const template = await validateAndLoadTemplate(args.template);
    const projectConfig = buildProjectConfig(process.cwd());
    await fs.mkdir(projectConfig.buildDir, { recursive: true });

    await printHeader(projectConfig, process.cwd());

    if (args.verbose) {
      await renderVerbose(projectConfig, template, args.template);

      return;
    }

    await renderWithReporter(projectConfig, template, args.template);
  },
});

// The branded header: the LeClap wordmark over an aligned status block (which ffmpeg backs the render,
// and where its assets come from). Detection is best-effort — a failure here is surfaced properly by
// compile() below, so we never block the render on it.
async function printHeader(projectConfig: ProjectConfig & { buildDir: string }, cwd: string): Promise<void> {
  process.stdout.write(wordmark());

  try {
    const det = await FFmpegDetector.detect();
    const engine =
      det.availability === FFmpegAvailability.NONE
        ? `${bad} ffmpeg not found  ${dot}  run ${pc.bold('leclap diagnose')}`
        : `${ok} ffmpeg ${pc.dim(det.version ?? '')}  ${dot}  ${pc.dim(det.availability)}`;
    console.log(statusRow('engine', engine));
  } catch {
    // Detection is decorative here; the real failure path is compile().
  }

  console.log(statusRow('assets', pc.dim(prettyAssets(projectConfig.assetsDir, cwd))));
  console.log('');
}

function prettyAssets(dir: string | undefined, cwd: string): string {
  if (!dir) return 'none';
  const rel = path.relative(cwd, dir);

  return rel === '' ? '.' : rel;
}

async function renderVerbose(
  projectConfig: ProjectConfig & { buildDir: string },
  template: TemplateDescriptor,
  templatePath: string
): Promise<void> {
  console.log(`Rendering ${pc.bold(path.basename(templatePath))}…`);
  const startedAt = Date.now();

  try {
    const result = await compile(projectConfig, template);

    if (!result) throw new Error('Compilation failed to produce output');
    console.log(summaryLine(result, startedAt, process.cwd()));
  } catch (error) {
    reportError(error);
  }
}

async function renderWithReporter(
  projectConfig: ProjectConfig & { buildDir: string },
  template: TemplateDescriptor,
  templatePath: string
): Promise<void> {
  const label = `Rendering ${pc.bold(path.basename(templatePath))}…`;
  const logPath = path.join(projectConfig.buildDir, 'render.log');
  const logRel = path.relative(process.cwd(), logPath);
  const interactive = process.stdout.isTTY;

  const logLines: string[] = [];
  const live = interactive ? new LiveRenderer(label) : null;

  const reporter: CompileReporter = {
    onProgress: (fraction) => live?.update(fraction),
    onLog: ({ level, message }) => {
      logLines.push(`${level.padEnd(5)} ${message}`);
      // The live tail shows meaningful steps; debug (ffmpeg command dumps) goes to the file only.
      if (level !== 'debug') live?.pushLog(message);
    },
  };

  const flushLog = (): void => {
    try {
      writeFileSync(logPath, `${logLines.join('\n')}\n`);
    } catch {
      // A log-file write failure must never mask the render result.
    }
  };

  if (live) live.start();

  if (!live) console.log(label);

  await executeRender({ projectConfig, template, reporter, flushLog, live, logRel });
}

interface RenderExecution {
  projectConfig: ProjectConfig & { buildDir: string };
  template: TemplateDescriptor;
  reporter: CompileReporter;
  flushLog: () => void;
  live: LiveRenderer | null;
  logRel: string;
}

// Run the compile and render its outcome (live finish or plain log lines), always flushing the log
// file first.
async function executeRender({
  projectConfig,
  template,
  reporter,
  flushLog,
  live,
  logRel,
}: RenderExecution): Promise<void> {
  const startedAt = Date.now();

  try {
    const result = await compile(projectConfig, template, reporter);

    if (!result) throw new Error('Compilation failed to produce output');

    flushLog();
    const summary = summaryLine(result, startedAt, process.cwd());
    const hintLine = hint(`  full log → ${logRel}`);

    if (live) {
      live.finishSuccess(`${summary}\n${hintLine}`);

      return;
    }

    console.log(summary);
    console.log(hintLine);
  } catch (error) {
    flushLog();
    live?.finishError();
    console.error(hint(`  full log → ${logRel}`));
    reportError(error);
  }
}
