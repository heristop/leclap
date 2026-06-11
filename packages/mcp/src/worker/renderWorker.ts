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

// Job sent from the parent over the IPC channel. The parent never reads this process's
// stdout/stderr for the result — that fd is polluted by the core's console.log/pino — so the
// outcome travels ONLY via process.send (IPC).
interface RenderJob {
  projectConfig: ProjectConfig;
  template: TemplateDescriptor;
}

type WorkerResult = { ok: true; outputPath: string; infos: unknown; sizeBytes: number } | { ok: false; error?: string };

function send(message: WorkerResult): void {
  process.send?.(message);
}

async function describeOutput(outputPath: string): Promise<WorkerResult> {
  const adapter = container.resolve<AbstractFFmpeg>('ffmpegAdapter');
  const infos = await adapter.getInfos(outputPath);
  const sizeBytes = (await fs.stat(outputPath)).size;

  return { ok: true, outputPath, infos, sizeBytes };
}

async function runJob(job: RenderJob): Promise<WorkerResult> {
  const outputPath = await compile(job.projectConfig, job.template);

  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    return { ok: false };
  }

  return describeOutput(outputPath);
}

async function handleMessage(job: RenderJob): Promise<void> {
  try {
    send(await runJob(job));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    send({ ok: false, error: message });
  } finally {
    process.exit(0);
  }
}

process.on('message', (job: RenderJob) => {
  handleMessage(job).catch(() => process.exit(1));
});
