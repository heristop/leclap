// What the Node compile() prepares between configuring the director and running it: refuse an output
// that would overwrite one of the render's own inputs, identify the FFmpeg build (its colour-tag flags
// and every cache key depend on it) and, when the host passed `cacheDir`, install the section cache.

import fs from 'node:fs';
import path from 'node:path';
import { container } from 'tsyringe';
import type AbstractFilesystem from '../platform/filesystem/AbstractFilesystem';
import type Project from '../core/models/Project';
import type AbstractFFmpeg from '../platform/ffmpeg/AbstractFFmpeg';
import type { ProjectConfig } from '@/core/types';
import { ffmpegVersionLine, versionFromLine } from '../platform/ffmpeg/analyze-node';
import { createSectionCache, type SectionCache } from './section-cache-node';
import { descriptorAssetFiles, renderRoots } from './render-manifest-node';

export interface NodeRenderContext {
  /** First line of `ffmpeg -version`, or null when the adapter runs no binary (or it could not run). */
  ffmpegVersionLine: string | null;
  cache: SectionCache | null;
}

export interface NodeRenderSetup {
  project: Project;
  adapter: AbstractFFmpeg;
  config: ProjectConfig;
  descriptor: unknown;
  buildDir: string;
  tempDir?: string;
}

function canonical(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function renderInputs(config: ProjectConfig, descriptor: unknown): string[] {
  const clips = Object.values(config.userVideoPaths ?? {});
  const assets = config.assetsDir ? descriptorAssetFiles(descriptor, config.assetsDir) : [];

  return [...clips, ...assets];
}

/**
 * Refuses a build whose output (or its staging file) is one of the render's inputs, e.g. a clip bound
 * with `userVideoPaths` that lives at `<buildDir>/output.mp4`: the final pass would overwrite the source
 * it is still reading.
 */
export function assertOutputIsNotInput(buildDir: string, config: ProjectConfig, descriptor: unknown): void {
  const outputs = new Set(['output.mp4', 'output.partial.mp4'].map((name) => canonical(path.join(buildDir, name))));
  const clash = renderInputs(config, descriptor).find((input) => outputs.has(canonical(input)));

  if (clash) {
    throw new Error(
      `Refusing to render: the output ${path.join(buildDir, 'output.mp4')} is also an input (${clash}). ` +
        'Move the input or choose another buildDir.'
    );
  }
}

export async function prepareNodeRender(setup: NodeRenderSetup): Promise<NodeRenderContext> {
  assertOutputIsNotInput(setup.buildDir, setup.config, setup.descriptor);

  const binary = setup.adapter.binaries?.ffmpeg;
  const versionLine = binary ? await ffmpegVersionLine(binary) : null;
  setup.project.ffmpegVersion = versionFromLine(versionLine);

  // The cache key names the exact FFmpeg build; without one, nothing can be reused safely.
  const cache =
    setup.config.cacheDir && versionLine
      ? createSectionCache({
          dir: path.resolve(setup.config.cacheDir),
          buildDir: setup.buildDir,
          roots: renderRoots(setup.config, setup.tempDir),
          ffmpegVersionLine: versionLine,
        })
      : null;
  setup.project.commandInterceptor = cache?.intercept ?? null;

  return { ffmpegVersionLine: versionLine, cache };
}

/** prepareNodeRender against the registered project, FFmpeg and filesystem adapters. */
export function prepareRegisteredRender(config: ProjectConfig, descriptor: unknown): Promise<NodeRenderContext> {
  const filesystem = container.resolve<AbstractFilesystem>('filesystemAdapter');

  return prepareNodeRender({
    project: container.resolve<Project>('project'),
    adapter: container.resolve<AbstractFFmpeg>('ffmpegAdapter'),
    config,
    descriptor,
    // The director hands this same value to the filesystem adapter, which names every segment after it.
    buildDir: path.resolve(config.buildDir ?? 'build'),
    tempDir: filesystem.getTempDir(),
  });
}
