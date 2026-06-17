import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpConfig } from '../src/config.js';

// Remotion is an optional peer dep, dynamically imported by the tool. Mock both modules + fs so the
// handler logic is tested deterministically without a real (headless-Chromium) render.
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));
vi.mock('@remotion/bundler', () => ({ bundle: vi.fn() }));
vi.mock('@remotion/renderer', () => ({
  ensureBrowser: vi.fn(),
  selectComposition: vi.fn(),
  renderMedia: vi.fn(),
  makeCancelSignal: vi.fn(() => ({ cancelSignal: {}, cancel: vi.fn() })),
}));

const { bundle } = await import('@remotion/bundler');
const { ensureBrowser, selectComposition, renderMedia } = await import('@remotion/renderer');
const { registerRenderRemotionClip } = await import('../src/tools/renderRemotionClip.js');

const bundleMock = vi.mocked(bundle);
const ensureBrowserMock = vi.mocked(ensureBrowser);
const selectCompositionMock = vi.mocked(selectComposition);
const renderMediaMock = vi.mocked(renderMedia);

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(config: McpConfig): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerRenderRemotionClip(fakeServer as never, config);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

const config: McpConfig = { outputDir: '/out', mediaDir: '/media', renderTimeoutMs: 1000 };

beforeEach(() => {
  vi.clearAllMocks();
  ensureBrowserMock.mockResolvedValue(undefined as never);
  bundleMock.mockResolvedValue('serve://bundle' as never);
  selectCompositionMock.mockResolvedValue({ width: 1280, height: 720, durationInFrames: 90, fps: 30 } as never);
  renderMediaMock.mockResolvedValue(undefined as never);
});
afterEach(() => vi.clearAllMocks());

describe('render_remotion_clip handler', () => {
  it('bundles the entry, renders the composition, and returns a project_video clip', async () => {
    const result = (await captureHandler(config)({
      entry: '/proj/src/index.ts',
      compositionId: 'MyIntro',
      inputProps: { wordmark: 'ACME' },
      outputName: 'intro',
    })) as { isError?: boolean; structuredContent?: Record<string, unknown> };

    expect(result.isError).toBeUndefined();
    expect(bundleMock).toHaveBeenCalledWith({ entryPoint: '/proj/src/index.ts' });
    expect(selectCompositionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'MyIntro', inputProps: { wordmark: 'ACME' } })
    );
    expect(result.structuredContent).toMatchObject({
      path: '/media/.leclap-remotion/intro.mp4',
      width: 1280,
      durationSeconds: 3,
    });
    expect(result.structuredContent?.sectionHint).toContain('project_video');
  });

  it('uses the configured remotionEntry when no entry/serveUrl is passed', async () => {
    const withDefault: McpConfig = { ...config, remotionEntry: '/default/index.ts' };

    await captureHandler(withDefault)({ compositionId: 'C' });

    expect(bundleMock).toHaveBeenCalledWith({ entryPoint: '/default/index.ts' });
  });

  it('errors when neither entry, serveUrl, nor a configured default is available', async () => {
    const result = (await captureHandler(config)({ compositionId: 'C' })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Provide `entry`');
    expect(bundleMock).not.toHaveBeenCalled();
  });

  it('surfaces a render failure as an error result', async () => {
    renderMediaMock.mockRejectedValue(new Error('boom'));

    const result = (await captureHandler(config)({ entry: '/proj/index.ts', compositionId: 'C' })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Remotion render failed');
  });

  it('rejects a remote serveUrl (would render attacker-hosted JS)', async () => {
    const result = (await captureHandler(config)({ serveUrl: 'http://evil.example/bundle', compositionId: 'C' })) as {
      isError?: boolean;
      content: { text: string }[];
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Remote serveUrl is not allowed');
    expect(bundleMock).not.toHaveBeenCalled();
  });

  it('allows a loopback serveUrl', async () => {
    await captureHandler(config)({ serveUrl: 'http://localhost:3000/bundle', compositionId: 'C' });

    expect(bundleMock).not.toHaveBeenCalled();
    expect(selectCompositionMock).toHaveBeenCalledWith(
      expect.objectContaining({ serveUrl: 'http://localhost:3000/bundle' })
    );
  });
});
