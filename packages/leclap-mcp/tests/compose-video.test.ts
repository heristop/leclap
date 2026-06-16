import 'reflect-metadata';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpConfig } from '../src/config.js';
import { runRender } from '../src/compose/renderRunner.js';
import { registerCompose } from '../src/tools/composeVideo.js';

vi.mock('../src/compose/renderRunner.js', () => ({
  runRender: vi.fn(),
}));

const runRenderMock = vi.mocked(runRender);

// Minimal McpServer stand-in: captures the handler the tool registers so we can invoke it
// directly with crafted args, no transport needed.
type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(cfg: McpConfig): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerCompose(fakeServer as never, cfg);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

let outputDir: string;
let mediaDir: string;
let config: McpConfig;

beforeEach(async () => {
  vi.clearAllMocks();
  outputDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-out-')));
  mediaDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-media-')));
  config = { outputDir, mediaDir, renderTimeoutMs: 1000 };
});

afterEach(async () => {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.rm(mediaDir, { recursive: true, force: true });
});

function setup() {
  return captureHandler(config);
}

// Premium templates wrap a single project_video named `video_1`; the compose handler rejects
// before rendering unless that clip is supplied. Stage a real file under the media dir so the
// path-safety check passes and the (mocked) render is reached.
async function stageClip(name = 'video_1'): Promise<Record<string, string>> {
  const clip = path.join(mediaDir, 'clip.mp4');
  await fs.writeFile(clip, 'stub');

  return { [name]: clip };
}

describe('compose_video handler', () => {
  it('returns structuredContent on a successful render', async () => {
    runRenderMock.mockResolvedValue({
      ok: true,
      outputPath: '/tmp/out.mp4',
      durationSeconds: 12.5,
      sizeBytes: 2048,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });

    const result = (await setup()({ templateName: 'landscape-spotlight', userVideoPaths: await stageClip() })) as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
    };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      outputPath: '/tmp/out.mp4',
      durationSeconds: 12.5,
      sizeBytes: 2048,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
    expect(result.structuredContent?.renderId).toBeTypeOf('string');
  });

  it('surfaces a render failure (with log tail) as an error result', async () => {
    runRenderMock.mockResolvedValue({
      ok: false,
      error: 'Compilation error: boom',
      logTail: 'ffmpeg said no',
    });

    const result = (await setup()({ templateName: 'landscape-spotlight', userVideoPaths: await stageClip() })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Compilation error: boom');
    expect(result.content[0].text).toContain('ffmpeg said no');
  });

  it('rejects before rendering when a required project_video clip is missing', async () => {
    // landscape-spotlight declares a single project_video section named `video_1`.
    const result = (await setup()({ templateName: 'landscape-spotlight' })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('video_1');
    expect(runRenderMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown templateName', async () => {
    const result = (await setup()({ templateName: 'no-such-template' })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown template');
    expect(runRenderMock).not.toHaveBeenCalled();
  });
});
