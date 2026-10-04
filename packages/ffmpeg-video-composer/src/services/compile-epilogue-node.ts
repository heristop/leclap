// What the Node compile() does after a render settles: the perf report and, when the host asked for
// one, the render manifest. Split out of index.ts for its line and dependency budgets.

import { container } from 'tsyringe';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type AbstractLogger from '../platform/logging/AbstractLogger';
import type Project from '../core/models/Project';
import type { CompileReporter, ProjectConfig, TemplateDescriptor } from '@/core/types';
import { getPerfTimer } from '../utils/perf-timer';
import { formatPerfReport } from '../utils/perf-report';
import { FFmpegDetector } from '../platform/ffmpeg/FFmpegDetector';
import { resolveDeterministic } from '@/core/determinism/contract';
import { createNodeRenderManifest } from './render-manifest-node';

export interface CompileEpilogueInput {
  logger: AbstractLogger;
  projectConfig: ProjectConfig;
  templateDescriptor: TemplateDescriptor;
  output: string | null;
  reporter?: CompileReporter;
}

// Log the per-run perf table and persist it next to the build output. No-op when FVC_PERF is
// disabled (the timer reports totalMs 0). Never throws — perf reporting must not break a compile.
async function emitPerfReport(
  logger: AbstractLogger,
  buildDir: string,
  templateDescriptor: TemplateDescriptor
): Promise<void> {
  const report = getPerfTimer().report();

  if (report.totalMs <= 0) {
    return;
  }

  logger.info(`\n${formatPerfReport(report)}`);

  try {
    const fileSystem = container.resolve<AbstractFilesystem>('filesystemAdapter');
    const data = new TextEncoder().encode(JSON.stringify(report, null, 2));
    // FVC_PERF_OUT lets a caller (the bench harness) pin an exact output path per run so reports
    // don't collide across fixtures that share a meta.name; otherwise name it from the descriptor.
    const explicit = process.env.FVC_PERF_OUT;

    if (explicit) {
      await fileSystem.writeFile(explicit, data);

      return;
    }
    const buildPath = await fileSystem.getBuildPath(buildDir);
    const name = (templateDescriptor.meta?.name ?? 'run').replace(/[^a-z0-9_-]+/gi, '_');
    await fileSystem.writeFile(`${buildPath}/perf-${name}.json`, data);
  } catch (error) {
    logger.info(`perf report write skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// The render manifest (core/determinism/manifest.ts), built only after a successful render and only
// when the host asked for it: it reads the output and every source file once to digest them.
async function emitRenderManifest(input: CompileEpilogueInput, output: string): Promise<void> {
  const onManifest = input.reporter?.onManifest;

  if (!onManifest) return;

  const project = container.resolve<Project>('project');
  const detection = await FFmpegDetector.detect();

  onManifest(
    createNodeRenderManifest({
      descriptor: input.templateDescriptor,
      config: input.projectConfig,
      commands: project.ffmpegCommands,
      deterministic: resolveDeterministic(input.projectConfig.deterministic),
      output,
      ffmpegVersion: detection.version ?? null,
      tempDir: container.resolve<AbstractFilesystem>('filesystemAdapter').getTempDir(),
    })
  );
}

export async function runCompileEpilogue(input: CompileEpilogueInput): Promise<void> {
  await emitPerfReport(input.logger, input.projectConfig.buildDir ?? '', input.templateDescriptor);

  if (input.output !== null) await emitRenderManifest(input, input.output);
}
