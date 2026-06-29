import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import {
  compile,
  loadConfig,
  FFmpegDetector,
  FFmpegAvailability,
  type CompileReporter,
  type ProjectConfig,
} from 'ffmpeg-video-composer';
import { setEngineLogLevel } from '../log.js';
import { LiveRenderer } from '../render-progress.js';
import { buildProjectConfig, type RenderFlags } from '../render-args.js';
import { summaryLine, safeSize } from '../render-format.js';
import { watchPaths } from '../watch.js';
import { fail, hint, step } from '../ui.js';
import { wordmark, statusRow, ok, bad, dot } from '../theme.js';

// Everything a render pass needs, assembled once from the CLI flags.
interface RenderOptions {
  templatePath: string;
  projectConfig: ProjectConfig & { buildDir: string };
  outputAbs?: string;
  quiet: boolean;
  json: boolean;
  verbose: boolean;
  watch: boolean;
}

// citty hands a repeatable string flag back as a single string, an array, or undefined — normalize to
// a string[] without stringifying non-strings (avoids `[object Object]` surprises).
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');

  if (typeof value === 'string') return [value];

  return [];
}

async function ensureTemplateExists(templatePath: string): Promise<void> {
  try {
    await fs.access(templatePath);
  } catch {
    console.error(fail(`Template not found: ${pc.bold(templatePath)}`));
    process.exit(1);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();

  if (typeof error === 'string') return error.trim();

  return JSON.stringify(error);
}

function printErrorHints(message: string): void {
  console.error(`\n${fail(message)}`);

  if (message.includes('FFmpeg') || message.includes('ffmpeg')) {
    console.error(hint('  try'));
    console.error(step('leclap diagnose'));
    console.error(step('npm i ffmpeg-static  (bundled fallback)'));
    console.error(step('macOS: brew install ffmpeg  ·  Linux: sudo apt install ffmpeg'));
  }
}

// Copy the engine's `build/output.mp4` to the user's `--output` path (engine output naming is fixed;
// per-render placement is the CLI's concern). Returns the path the summary should report.
async function finalizeOutput(result: string, outputAbs: string | undefined): Promise<string> {
  if (!outputAbs) return result;

  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  await fs.copyFile(result, outputAbs);

  return outputAbs;
}

// Re-load the template (so watch picks up edits), compile, and place the output. Throws on failure.
async function compileOnce(opts: RenderOptions, reporter?: CompileReporter): Promise<string> {
  const template = await loadConfig(opts.templatePath);
  const result = await compile(opts.projectConfig, template, reporter);

  if (!result) throw new Error('Compilation failed to produce output');

  return finalizeOutput(result, opts.outputAbs);
}

export const render = defineCommand({
  meta: { name: 'render', description: 'Compile a video from a template JSON' },
  args: {
    template: { type: 'positional', description: 'Path to a template JSON file', required: true },
    output: { type: 'string', alias: 'o', description: 'Copy the rendered video to this path' },
    field: { type: 'string', description: 'Set a template variable: --field key=value (repeatable)' },
    video: { type: 'string', description: 'Map a project_video section to a file: --video section=path (repeatable)' },
    locale: { type: 'string', description: 'Locale for translated text (e.g. en, fr)' },
    orientation: { type: 'string', description: 'Override orientation: landscape | portrait | square' },
    assets: { type: 'string', description: 'Assets directory (default ./assets)' },
    build: { type: 'string', description: 'Build/output directory (default ./build)' },
    watch: { type: 'boolean', description: 'Re-render when the template or its assets change', default: false },
    quiet: { type: 'boolean', alias: 'q', description: 'Print only the final result', default: false },
    json: { type: 'boolean', description: 'Emit a machine-readable JSON result', default: false },
    verbose: { type: 'boolean', description: 'Stream the underlying engine logs', default: false },
  },
  async run({ args }) {
    const json = args.json;
    const quiet = args.quiet || json;
    const verbose = args.verbose && !json;

    // --verbose streams the engine's own logs to stdout; otherwise the CLI owns the terminal (engine
    // silent, logs teed to a file + live region). JSON mode is always silent.
    setEngineLogLevel(verbose ? 'info' : 'silent');
    process.env.LECLAP_CLI_UI = '1';

    await ensureTemplateExists(args.template);

    const flags: RenderFlags = {
      field: toList(args.field),
      video: toList(args.video),
      locale: args.locale,
      orientation: args.orientation,
      assets: args.assets,
      build: args.build,
    };

    const opts = buildOptions(args.template, flags, { quiet, json, verbose, watch: args.watch, output: args.output });

    await fs.mkdir(opts.projectConfig.buildDir, { recursive: true });

    await dispatch(opts);
  },
});

interface ModeFlags {
  quiet: boolean;
  json: boolean;
  verbose: boolean;
  watch: boolean;
  output?: string;
}

// Assemble RenderOptions; surfaces a bad `--field`/`--video` value as a clean error + exit.
function buildOptions(templatePath: string, flags: RenderFlags, mode: ModeFlags): RenderOptions {
  try {
    return {
      templatePath,
      projectConfig: buildProjectConfig(process.cwd(), flags),
      outputAbs: mode.output ? path.resolve(process.cwd(), mode.output) : undefined,
      quiet: mode.quiet,
      json: mode.json,
      verbose: mode.verbose,
      watch: mode.watch,
    };
  } catch (error) {
    console.error(fail(errorMessage(error)));

    return process.exit(1);
  }
}

async function dispatch(opts: RenderOptions): Promise<void> {
  if (opts.json) {
    await renderJson(opts);

    return;
  }

  if (!opts.quiet) {
    await printHeader(opts.projectConfig, process.cwd());
  }

  // --watch ignores non-interactive sessions (nothing to repaint); fall through to a single render.
  if (opts.watch && process.stdout.isTTY) {
    await renderWatch(opts);

    return;
  }

  if (opts.verbose) {
    await renderVerbose(opts);

    return;
  }

  await renderWithReporter(opts);
}

// The branded header: the LeClap wordmark over an aligned status block (which ffmpeg backs the render,
// and where its assets come from). Detection is best-effort — a real failure is surfaced by compile().
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

// JSON mode: one machine-readable object, no colour/progress. Exit 1 on failure.
async function renderJson(opts: RenderOptions): Promise<void> {
  const startedAt = Date.now();

  try {
    const output = await compileOnce(opts);
    const result = { ok: true, output, bytes: safeSize(output), durationMs: Date.now() - startedAt };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: errorMessage(error) })}\n`);
    process.exit(1);
  }
}

async function renderVerbose(opts: RenderOptions): Promise<void> {
  console.log(`Rendering ${pc.bold(path.basename(opts.templatePath))}…`);
  const startedAt = Date.now();

  try {
    const output = await compileOnce(opts);
    console.log(summaryLine(output, startedAt, process.cwd(), Date.now()));
  } catch (error) {
    printErrorHints(errorMessage(error));
    process.exit(1);
  }
}

interface ReporterBundle {
  reporter: CompileReporter;
  flushLog: () => void;
  logRel: string;
}

// Build the log-teeing reporter + live region for a non-verbose render.
function makeReporter(opts: RenderOptions, live: LiveRenderer | null): ReporterBundle {
  const logPath = path.join(opts.projectConfig.buildDir, 'render.log');
  const logLines: string[] = [];

  const reporter: CompileReporter = {
    onProgress: (fraction) => live?.update(fraction),
    onLog: ({ level, message }) => {
      logLines.push(`${level.padEnd(5)} ${message}`);

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

  return { reporter, flushLog, logRel: path.relative(process.cwd(), logPath) };
}

async function renderWithReporter(opts: RenderOptions): Promise<void> {
  const label = `Rendering ${pc.bold(path.basename(opts.templatePath))}…`;
  const live = process.stdout.isTTY && !opts.quiet ? new LiveRenderer(label) : null;
  const { reporter, flushLog, logRel } = makeReporter(opts, live);
  const startedAt = Date.now();

  if (live) live.start();

  if (!live && !opts.quiet) console.log(label);

  try {
    const output = await compileOnce(opts, reporter);
    flushLog();
    finishSuccess(output, startedAt, live, opts.quiet ? null : logRel);
  } catch (error) {
    flushLog();
    live?.finishError();

    if (!opts.quiet) console.error(hint(`  full log → ${logRel}`));

    printErrorHints(errorMessage(error));
    process.exit(1);
  }
}

// Print the success summary, optionally with the log-path hint, via the live region when present.
function finishSuccess(output: string, startedAt: number, live: LiveRenderer | null, logRel: string | null): void {
  const summary = summaryLine(output, startedAt, process.cwd(), Date.now());
  const block = logRel ? `${summary}\n${hint(`  full log → ${logRel}`)}` : summary;

  if (live) {
    live.finishSuccess(block);

    return;
  }

  console.log(block);
}

// --watch: render once, then re-render on template/asset changes until Ctrl-C. A failed pass is
// reported but never exits, so the loop survives typos while you edit.
async function renderWatch(opts: RenderOptions): Promise<void> {
  let busy = false;
  let queued = false;

  const pass = async (): Promise<void> => {
    if (busy) {
      queued = true;

      return;
    }

    busy = true;

    try {
      await watchPass(opts);
    } finally {
      busy = false;

      if (queued) {
        queued = false;
        pass().catch(() => {});
      }
    }
  };

  await pass();

  const targets = [opts.templatePath, opts.projectConfig.assetsDir].filter((p): p is string => Boolean(p));
  watchPaths(targets, () => {
    pass().catch(() => {});
  });

  console.log(hint(`  watching ${pc.bold(path.basename(opts.templatePath))} + assets — ctrl-c to stop`));
}

// A single watch render: live region, but errors are printed and swallowed (the watcher keeps running).
async function watchPass(opts: RenderOptions): Promise<void> {
  const label = `Rendering ${pc.bold(path.basename(opts.templatePath))}…`;
  const live = process.stdout.isTTY ? new LiveRenderer(label) : null;
  const { reporter, flushLog } = makeReporter(opts, live);
  const startedAt = Date.now();

  if (live) live.start();

  try {
    const output = await compileOnce(opts, reporter);
    flushLog();
    finishSuccess(output, startedAt, live, null);
  } catch (error) {
    flushLog();
    live?.finishError();
    console.error(fail(errorMessage(error)));
  }
}
