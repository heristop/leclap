import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProjectConfig, TemplateDescriptor } from 'ffmpeg-video-composer';
import { z } from 'zod';

import type { McpConfig } from '../config.js';
import { assertWithinMediaDir } from '../compose/pathGuard.js';
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

async function handleCompose(args: ComposeArgs, config: McpConfig) {
  const descriptor = resolveDescriptor(args);

  if ('isError' in descriptor) {
    return descriptor;
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

  const renderId = newRenderId();
  const projectConfig = await buildProjectConfig(args, resolved.paths, config.outputDir, renderId);
  const result = await runRender(
    { projectConfig, template: descriptor.descriptor },
    { timeoutMs: config.renderTimeoutMs }
  );

  if (!result.ok) {
    return failurePayload(result);
  }

  return successPayload(result, renderId);
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
    (args: ComposeArgs) => handleCompose(args, config)
  );
}
