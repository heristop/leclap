import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProjectConfig, TemplateDescriptor } from 'ffmpeg-video-composer';
import { z } from 'zod';

import type { McpConfig } from '../config.js';
import { assertWithinMediaDir } from '../compose/pathGuard.js';
import { assertDescriptorSafe } from '../compose/descriptorGuard.js';
import { validateTemplate } from '../compose/validation.js';
import { runRender, type RenderResult } from '../compose/renderRunner.js';

const inputShape = {
  template: z.record(z.string(), z.unknown()),
  fields: z.record(z.string(), z.string()).optional(),
  userVideoPaths: z.record(z.string(), z.string()).optional(),
  locale: z.string().optional(),
  outputBaseName: z
    .string()
    .regex(/^[\w-]+$/)
    .optional(),
};

const outputShape = {
  outputPath: z.string(),
  durationSeconds: z.number().nullable(),
  sizeBytes: z.number(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  renderId: z.string(),
};

type ComposeArgs = {
  template: Record<string, unknown>;
  fields?: Record<string, string>;
  userVideoPaths?: Record<string, string>;
  locale?: string;
  outputBaseName?: string;
};

type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };
type DescriptorResult = { ok: true; descriptor: TemplateDescriptor } | ToolError;

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

// Validate the inline descriptor against the core schema before rendering.
function resolveDescriptor(args: ComposeArgs): DescriptorResult {
  const result = validateTemplate(args.template);

  if (!result.ok) {
    return errorResult(result.message);
  }

  return { ok: true, descriptor: result.descriptor };
}

function requiredVideoSections(descriptor: TemplateDescriptor): string[] {
  const sections = descriptor.sections ?? [];

  return sections
    .filter((section) => section.type === 'project_video' && typeof section.name === 'string')
    .map((section) => section.name as string);
}

// Reject when a required project_video section has no supplied clip, or when a supplied key names a
// section the template does not declare.
function checkSectionCoverage(descriptor: TemplateDescriptor, provided: Record<string, string>): ToolError | undefined {
  const required = requiredVideoSections(descriptor);
  const missing = required.filter((name) => !(name in provided));

  if (missing.length > 0) {
    return errorResult(`Missing clips for project_video section(s): ${missing.join(', ')}.`);
  }

  const known = new Set(required);
  const unknown = Object.keys(provided).filter((name) => !known.has(name));

  if (unknown.length > 0) {
    return errorResult(`Unknown userVideoPaths section(s): ${unknown.join(', ')}.`);
  }

  return undefined;
}

type SectionResolution = { section: string; real: string } | { section: string; error: string };

async function resolveOne(section: string, value: string, mediaDir: string): Promise<SectionResolution> {
  try {
    return { section, real: await assertWithinMediaDir(value, mediaDir) };
  } catch (error) {
    return { section, error: error instanceof Error ? error.message : String(error) };
  }
}

// Realpath-check every provided clip against the media dir (rejects traversal/symlink escape),
// returning the canonicalized map the worker will receive. Checks run in parallel; the first
// rejection wins.
async function resolveVideoPaths(
  provided: Record<string, string>,
  mediaDir: string
): Promise<{ ok: true; paths: Record<string, string> } | ToolError> {
  const resolutions = await Promise.all(
    Object.entries(provided).map(([section, value]) => resolveOne(section, value, mediaDir))
  );

  const failure = resolutions.find((entry): entry is { section: string; error: string } => 'error' in entry);

  if (failure) {
    return errorResult(failure.error);
  }

  const paths: Record<string, string> = {};

  for (const entry of resolutions) {
    if ('real' in entry) {
      paths[entry.section] = entry.real;
    }
  }

  return { ok: true, paths };
}

function newRenderId(): string {
  return `${Date.now()}-${randomBytes(3).toString('hex')}`;
}

async function buildProjectConfig(
  args: ComposeArgs,
  userVideoPaths: Record<string, string>,
  outputDir: string,
  renderId: string
): Promise<ProjectConfig> {
  const buildDir = path.join(outputDir, renderId);
  await fs.mkdir(buildDir, { recursive: true });

  return {
    buildDir,
    assetsDir: buildDir,
    userVideoPaths,
    fields: args.fields,
    currentLocale: args.locale,
  };
}

function successPayload(result: Extract<RenderResult, { ok: true }>, renderId: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Rendered ${result.outputPath} (${result.durationSeconds ?? '?'}s, ${result.sizeBytes} bytes).`,
      },
    ],
    structuredContent: {
      outputPath: result.outputPath,
      durationSeconds: result.durationSeconds,
      sizeBytes: result.sizeBytes,
      videoCodec: result.videoCodec,
      audioCodec: result.audioCodec,
      renderId,
    },
  };
}

function failurePayload(result: Extract<RenderResult, { ok: false }>): ToolError {
  const tail = result.logTail ? `\n${result.logTail}` : '';

  return errorResult(`${result.error}${tail}`);
}

type PreparedCompose = { ok: true; descriptor: TemplateDescriptor; paths: Record<string, string> };

// Validate the descriptor, contain its raw filter chain, check section coverage, and realpath-guard
// every supplied clip — returning either the render-ready inputs or the first tool error.
async function prepareCompose(args: ComposeArgs, config: McpConfig): Promise<PreparedCompose | ToolError> {
  const descriptor = resolveDescriptor(args);

  if ('isError' in descriptor) {
    return descriptor;
  }

  // Contain the descriptor's raw filter chain (source filters, file/URL-bearing values, fontfile
  // paths) before it reaches ffmpeg — the schema alone does not stop it escaping the media-dir sandbox.
  const safety = await assertDescriptorSafe(descriptor.descriptor, config.mediaDir);

  if (!safety.ok) {
    return errorResult(safety.message);
  }

  const provided = args.userVideoPaths ?? {};
  const coverageError = checkSectionCoverage(descriptor.descriptor, provided);

  if (coverageError) {
    return coverageError;
  }

  const resolved = await resolveVideoPaths(provided, config.mediaDir);

  if ('isError' in resolved) {
    return resolved;
  }

  return { ok: true, descriptor: descriptor.descriptor, paths: resolved.paths };
}

// Name the deliverable and prune the render dir down to it, then build the success payload.
async function finalizeRender(result: Extract<RenderResult, { ok: true }>, args: ComposeArgs, renderId: string) {
  const outputPath = await applyOutputName(result.outputPath, args.outputBaseName);
  // Keep only the deliverable(s); the engine's intermediate segments/concat lists/staged assets are
  // dead weight once the final mp4 exists. Prune the dir that actually holds the output (both the
  // named copy and the engine output live there), so this is safe whether or not the engine nests
  // its output under buildDir. Best-effort — never fail a good render on cleanup.
  await pruneRenderDir(path.dirname(result.outputPath), [path.basename(outputPath), path.basename(result.outputPath)]);

  return successPayload({ ...result, outputPath }, renderId);
}

async function handleCompose(args: ComposeArgs, config: McpConfig, signal?: AbortSignal) {
  const prepared = await prepareCompose(args, config);

  if ('isError' in prepared) {
    return prepared;
  }

  const renderId = newRenderId();
  const buildDir = path.join(config.outputDir, renderId);
  const projectConfig = await buildProjectConfig(args, prepared.paths, config.outputDir, renderId);
  const result = await runRender(
    { projectConfig, template: prepared.descriptor },
    { timeoutMs: config.renderTimeoutMs, signal }
  );

  if (!result.ok) {
    // Nothing usable was produced — drop the whole render dir so failed/cancelled calls don't
    // accumulate on disk.
    await removeDir(buildDir);

    return failurePayload(result);
  }

  return finalizeRender(result, args, renderId);
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

// Delete everything in the render dir except the kept deliverables. Recurses so intermediate
// subdirs are removed too. Swallows errors — cleanup must never turn a successful render into one.
async function pruneRenderDir(dir: string, keep: string[]): Promise<void> {
  const kept = new Set(keep);

  try {
    const entries = await fs.readdir(dir);
    await Promise.all(
      entries
        .filter((entry) => !kept.has(entry))
        .map((entry) => fs.rm(path.join(dir, entry), { recursive: true, force: true }).catch(() => {}))
    );
  } catch {
    // Directory unreadable — nothing to prune.
  }
}

// Honour the optional outputBaseName by copying the fixed engine output (build/output.mp4) to a
// sibling `<outputBaseName>.mp4`, so the caller gets the name it asked for (per-render naming is an
// app concern, not the engine's). The regex on the input schema already rejects path separators.
// A copy failure must NOT sink a render that already succeeded — fall back to the real output path
// so the caller still gets a usable clip instead of a spurious tool error.
async function applyOutputName(outputPath: string, outputBaseName: string | undefined): Promise<string> {
  if (!outputBaseName) {
    return outputPath;
  }

  const named = path.join(path.dirname(outputPath), `${outputBaseName}.mp4`);

  if (named === outputPath) {
    return outputPath;
  }

  try {
    await fs.copyFile(outputPath, named);

    return named;
  } catch {
    return outputPath;
  }
}

export function registerCompose(server: McpServer, config: McpConfig): void {
  server.registerTool(
    'compose_video',
    {
      title: 'Compose Video',
      description:
        'Render a video from an inline template descriptor (`template`). Supply user clips via ' +
        'userVideoPaths (absolute paths under the configured media dir) for each project_video ' +
        'section, optional form `fields`, and an optional `locale`. Renders in a forked worker and ' +
        'returns the output mp4 path plus duration/codec metadata.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: ComposeArgs, extra?: { signal?: AbortSignal }) => handleCompose(args, config, extra?.signal)
  );
}
