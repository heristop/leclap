import { existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { McpConfig } from '../config.js';

const inputShape = {
  // Path to the consumer's Remotion entry (the module that calls registerRoot). Falls back to the
  // server's configured default (LECLAP_MCP_REMOTION_ENTRY). `serveUrl` skips bundling entirely.
  entry: z.string().optional(),
  serveUrl: z.string().optional(),
  compositionId: z.string(),
  inputProps: z.record(z.string(), z.unknown()).optional(),
  outputName: z
    .string()
    .regex(/^[\w-]+$/)
    .optional(),
};

const outputShape = {
  path: z.string(),
  width: z.number(),
  height: z.number(),
  durationSeconds: z.number(),
  sectionHint: z.string(),
};

type ClipArgs = {
  entry?: string;
  serveUrl?: string;
  compositionId: string;
  inputProps?: Record<string, unknown>;
  outputName?: string;
};
type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

// Remotion is an OPTIONAL peer dependency, loaded only when this tool runs so the MCP stays
// self-contained for consumers who don't use it. A missing module surfaces as a clear error.
type RemotionModules = {
  bundle: (options: { entryPoint: string }) => Promise<string>;
  ensureBrowser: () => Promise<unknown>;
  selectComposition: (options: { serveUrl: string; id: string; inputProps?: unknown }) => Promise<{
    width: number;
    height: number;
    durationInFrames: number;
    fps: number;
  }>;
  renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
  makeCancelSignal: () => { cancelSignal: unknown; cancel: () => void };
};

async function loadRemotion(): Promise<RemotionModules | { error: string }> {
  try {
    const bundler = (await import('@remotion/bundler')) as unknown as { bundle: RemotionModules['bundle'] };
    const renderer = (await import('@remotion/renderer')) as unknown as Omit<RemotionModules, 'bundle'>;

    return { bundle: bundler.bundle, ...renderer };
  } catch {
    return {
      error:
        'render_remotion_clip needs Remotion. Install the optional peer deps `@remotion/renderer` and ' +
        '`@remotion/bundler` (v4+) in your project to use it.',
    };
  }
}

// A prebuilt serveUrl wins; otherwise bundle the consumer's entry (per-call or configured default).
async function resolveServeUrl(
  args: ClipArgs,
  config: McpConfig,
  remotion: RemotionModules
): Promise<{ serveUrl: string } | ToolError> {
  if (args.serveUrl) {
    return { serveUrl: args.serveUrl };
  }

  const entry = args.entry ?? config.remotionEntry;

  if (!entry) {
    return errorResult(
      'Provide `entry` (path to your Remotion registerRoot module) or a prebuilt `serveUrl`, or ' +
        'start the server with --remotion-entry / LECLAP_MCP_REMOTION_ENTRY.'
    );
  }

  if (!existsSync(entry)) {
    return errorResult(`Remotion entry not found: ${entry}`);
  }

  return { serveUrl: await remotion.bundle({ entryPoint: entry }) };
}

function clipOutputPath(config: McpConfig, outputName?: string): string {
  const dir = path.join(config.mediaDir, '.leclap-remotion');
  mkdirSync(dir, { recursive: true });
  const name = outputName ?? `clip-${randomBytes(3).toString('hex')}`;

  return path.join(dir, `${name}.mp4`);
}

interface RenderJob {
  serveUrl: string;
  composition: unknown;
  outPath: string;
  inputProps?: Record<string, unknown>;
  timeoutMs: number;
}

// Render the selected composition to `outPath`, cancelling if it overruns the render timeout.
async function renderToFile(remotion: RemotionModules, job: RenderJob): Promise<ToolError | undefined> {
  const { cancelSignal, cancel } = remotion.makeCancelSignal();
  const timer = setTimeout(cancel, job.timeoutMs);

  try {
    await remotion.renderMedia({
      composition: job.composition,
      serveUrl: job.serveUrl,
      codec: 'h264',
      outputLocation: job.outPath,
      inputProps: job.inputProps,
      cancelSignal,
    });

    return undefined;
  } catch (error) {
    return errorResult(`Remotion render failed: ${describe(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function handleRender(args: ClipArgs, config: McpConfig) {
  const remotion = await loadRemotion();

  if ('error' in remotion) {
    return errorResult(remotion.error);
  }

  const resolved = await resolveServeUrl(args, config, remotion);

  if ('isError' in resolved) {
    return resolved;
  }

  const outPath = clipOutputPath(config, args.outputName);
  await remotion.ensureBrowser();

  let composition;

  try {
    composition = await remotion.selectComposition({
      serveUrl: resolved.serveUrl,
      id: args.compositionId,
      inputProps: args.inputProps,
    });
  } catch (error) {
    return errorResult(`Unknown or invalid composition "${args.compositionId}": ${describe(error)}`);
  }

  const failure = await renderToFile(remotion, {
    serveUrl: resolved.serveUrl,
    composition,
    outPath,
    inputProps: args.inputProps,
    timeoutMs: config.renderTimeoutMs,
  });

  if (failure) {
    return failure;
  }

  const durationSeconds = composition.durationInFrames / composition.fps;
  const sectionHint =
    `Add a leading section { name: "intro", type: "project_video", options: { duration: ${durationSeconds} } } ` +
    `and call compose_video with userVideoPaths: { "intro": "${outPath}" } to composite this Remotion ` +
    'clip in front of your FFmpeg-rendered scenes.';

  return {
    content: [
      {
        type: 'text' as const,
        text: `Rendered Remotion composition "${args.compositionId}" → ${outPath} (${composition.width}x${composition.height}, ${durationSeconds}s). ${sectionHint}`,
      },
    ],
    structuredContent: {
      path: outPath,
      width: composition.width,
      height: composition.height,
      durationSeconds,
      sectionHint,
    },
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerRenderRemotionClip(server: McpServer, config: McpConfig): void {
  server.registerTool(
    'render_remotion_clip',
    {
      title: 'Render Remotion Clip',
      description:
        'Render a composition from YOUR Remotion project to an mp4 (real motion graphics an FFmpeg ' +
        'filtergraph cannot express). Point it at your Remotion entry (`entry`, or a prebuilt `serveUrl`, ' +
        'or the configured --remotion-entry) and a `compositionId`, with optional `inputProps`. Returns ' +
        'the clip path; feed it to compose_video as a `project_video` clip (see sectionHint) so FFmpeg ' +
        'composites it in front of your scenes. Needs the optional peer deps @remotion/renderer + ' +
        '@remotion/bundler; design-time only (headless Chromium), not an on-device path.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: ClipArgs) => handleRender(args, config)
  );
}
