import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { McpConfig } from '../config.js';
import { assertWithinMediaDir } from '../compose/pathGuard.js';

const execFileAsync = promisify(execFile);
const requireModule = createRequire(import.meta.url);

const inputShape = {
  path: z.string(),
};

const outputShape = {
  durationSeconds: z.number().nullable(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  sampleRate: z.number().nullable(),
  sizeBytes: z.number(),
};

interface FFProbeStream {
  codec_type: string;
  codec_name?: string | null;
  duration?: string;
  sample_rate?: string;
}

interface FFProbeData {
  // Optional because the JSON comes from ffprobe at runtime; a malformed payload may omit it.
  streams?: FFProbeStream[];
}

export interface ProbeInfos {
  durationSeconds: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate: number | null;
  sizeBytes: number;
  // Index signature so the object satisfies the SDK's structuredContent record type.
  [key: string]: unknown;
}

type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

// Resolve the ffprobe binary the same way the core does: prefer `ffprobe` on PATH, fall back to the
// binary shipped alongside ffmpeg-static (sibling of the ffmpeg-static path, name swapped). Cached
// after first resolution.
let cachedBin: string | undefined;

async function resolveFfprobeBin(): Promise<string> {
  if (cachedBin !== undefined) {
    return cachedBin;
  }

  try {
    await execFileAsync('ffprobe', ['-version']);
    cachedBin = 'ffprobe';

    return cachedBin;
  } catch {
    cachedBin = resolveStaticFfprobe();

    return cachedBin;
  }
}

function resolveStaticFfprobe(): string {
  try {
    const ffprobeStatic = requireModule('ffprobe-static') as { path: string };

    return ffprobeStatic.path;
  } catch {
    const ffmpegStatic = requireModule('ffmpeg-static') as string | null;

    if (!ffmpegStatic) {
      throw new Error('No ffprobe binary found (PATH and ffmpeg-static both unavailable).');
    }

    return ffmpegStatic.replace(/ffmpeg(\.exe)?$/, (_m, ext: string | undefined) => `ffprobe${ext ?? ''}`);
  }
}

// Probe a local file by invoking ffprobe directly via execFile. This captures stdout into a buffer
// (zero fd-1 pollution) and deliberately bypasses the core's DI-wired adapter, which logs via pino
// straight to fd 1 — that would corrupt the MCP stdio JSON-RPC framing.
export type ProbeRunner = (realPath: string) => Promise<FFProbeData>;

const defaultRunner: ProbeRunner = async (realPath) => {
  const bin = await resolveFfprobeBin();
  const { stdout } = await execFileAsync(bin, ['-v', 'quiet', '-print_format', 'json', '-show_streams', realPath]);

  return JSON.parse(stdout) as FFProbeData;
};

function parseDuration(stream: FFProbeStream | undefined): number | null {
  if (!stream?.duration) {
    return null;
  }

  const value = Number.parseFloat(stream.duration);

  return Number.isNaN(value) ? null : value;
}

function parseSampleRate(stream: FFProbeStream | undefined): number | null {
  if (!stream?.sample_rate) {
    return null;
  }

  const value = Number.parseInt(stream.sample_rate, 10);

  return Number.isNaN(value) ? null : value;
}

export async function probeMedia(
  realPath: string,
  sizeBytes: number,
  runner: ProbeRunner = defaultRunner
): Promise<ProbeInfos> {
  const data = await runner(realPath);
  const streams = data.streams ?? [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  return {
    durationSeconds: parseDuration(videoStream) ?? parseDuration(audioStream),
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    sampleRate: parseSampleRate(audioStream),
    sizeBytes,
  };
}

async function handleProbe(args: { path: string }, config: McpConfig, runner: ProbeRunner) {
  let realPath: string;

  try {
    realPath = await assertWithinMediaDir(args.path, config.mediaDir);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }

  try {
    const { size } = await fs.stat(realPath);
    const infos = await probeMedia(realPath, size, runner);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Probed ${realPath} (${infos.durationSeconds ?? '?'}s, ${infos.videoCodec ?? 'no video'}/${infos.audioCodec ?? 'no audio'}, ${infos.sizeBytes} bytes).`,
        },
      ],
      structuredContent: infos,
    };
  } catch (error) {
    return errorResult(`Probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function registerProbe(server: McpServer, config: McpConfig, runner: ProbeRunner = defaultRunner): void {
  server.registerTool(
    'probe_media',
    {
      title: 'Probe Media',
      description:
        'Inspect a local media file (absolute path under the configured media dir) and return its ' +
        'duration, video/audio codecs, audio sample rate, and byte size. Probes via ffprobe directly ' +
        'so it never writes to stdout.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: { path: string }) => handleProbe(args, config, runner)
  );
}
