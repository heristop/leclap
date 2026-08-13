// FIRST import: the core uses tsyringe, which needs the reflect-metadata polyfill installed
// before any decorated class loads. Must precede the `ffmpeg-video-composer` import below.
import 'reflect-metadata';

import fs from 'node:fs/promises';
import {
  compile,
  container,
  type AbstractFFmpeg,
  type ProjectConfig,
  type TemplateDescriptor,
} from 'ffmpeg-video-composer';

import { createProgressReporter, type ProgressMessage } from './progress-reporter.js';

// Job sent from the parent over the IPC channel. The parent never reads this process's
// stdout/stderr for the result — that fd is polluted by the core's console.log/pino — so the
// outcome travels ONLY via process.send (IPC).
interface RenderJob {
  projectConfig: ProjectConfig;
  template: TemplateDescriptor;
}

type WorkerResult = { ok: true; outputPath: string; infos: unknown; sizeBytes: number } | { ok: false; error?: string };

// process.send is asynchronous: the message is queued on the IPC channel and flushed on the next
// tick. Exiting immediately after (as a `finally { process.exit(0) }` would) can truncate that flush,
// so the parent sees only 'exit' and reports a successful render as a failure. Exit ONLY from the
// send callback (fired once the channel has accepted the message); fall back to a plain exit when
// there is no IPC channel (worker run standalone).
function sendAndExit(message: WorkerResult): void {
  if (!process.send) {
    process.exit(0);
  }

  process.send(message, undefined, undefined, () => process.exit(0));
}

async function describeOutput(outputPath: string): Promise<WorkerResult> {
  const adapter = container.resolve<AbstractFFmpeg>('ffmpegAdapter');
  const infos = await adapter.getInfos(outputPath);
  const sizeBytes = (await fs.stat(outputPath)).size;

  return { ok: true, outputPath, infos, sizeBytes };
}

// Progress pings are best-effort telemetry: if the channel is gone the render still completes, so
// this never throws. The terminal result still travels via sendAndExit's acknowledged send.
function sendProgress(message: ProgressMessage): void {
  process.send?.(message);
}

async function runJob(job: RenderJob): Promise<WorkerResult> {
  const outputPath = await compile(job.projectConfig, job.template, {
    onProgress: createProgressReporter(sendProgress),
  });

  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    return { ok: false };
  }

  return describeOutput(outputPath);
}

async function resolveResult(job: RenderJob): Promise<WorkerResult> {
  try {
    return await runJob(job);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function handleMessage(job: RenderJob): Promise<void> {
  sendAndExit(await resolveResult(job));
}

process.on('message', (job: RenderJob) => {
  handleMessage(job).catch(() => process.exit(1));
});
