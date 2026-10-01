import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareTitleJob, renderTitleJob } from '../src/effects/registered-render.js';
import { loadRemotion } from '../src/tools/renderRemotionClip.js';

vi.mock('node:child_process', () => ({
  execFile: (_file: unknown, _args: unknown, _opts: unknown, cb: Function) => cb(null, 'Chromium 123.0.0', ''),
}));
vi.mock('../src/tools/renderRemotionClip.js', () => ({
  loadRemotion: vi.fn(),
  withTimeout: async (_label: string, _ms: number, run: () => Promise<unknown>) => run(),
}));
let dir: string;
let config: any;
let title: any;
const composition = { width: 1280, height: 720, fps: 30, durationInFrames: 300 };
beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-effect-render-test-')));
  for (const name of ['background.mp4', 'logo.png', 'font.ttf', 'entry.tsx']) {
    await fs.writeFile(path.join(dir, name), name);
  }
  config = {
    mediaDir: dir,
    outputDir: dir,
    remotionEntry: path.join(dir, 'entry.tsx'),
    allowRemotion: true,
    browserExecutable: '/local/chrome',
    renderTimeoutMs: 1000,
  };
  title = {
    section: { name: 'title', type: 'effect', options: { duration: 10 } },
    props: { headline: 'LECLAP', headlineY: 320, logoDelayFrames: 15, entranceDurationFrames: 24, springDamping: 18 },
    assets: {
      background: path.join(dir, 'background.mp4'),
      logo: path.join(dir, 'logo.png'),
      font: path.join(dir, 'font.ttf'),
    },
  };
  vi.mocked(loadRemotion).mockResolvedValue({
    bundle: async (options: any) => {
      await fs.mkdir(options.outDir, { recursive: true });
      await fs.writeFile(path.join(options.outDir, 'bundle.js'), 'trusted code');
      await fs.cp(options.publicDir, path.join(options.outDir, 'public'), { recursive: true });
      return options.outDir;
    },
    ensureBrowser: async () => {
      throw new Error('must use configured browser');
    },
    selectComposition: async () => composition,
    makeCancelSignal: () => ({ cancelSignal: {}, cancel: () => {} }),
    renderMedia: async (options: any) => {
      await fs.writeFile(options.outputLocation, 'mp4');
    },
    renderStill: async (options: any) => {
      await fs.writeFile(options.output, 'png');
    },
  } as never);
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
describe('registered immutable Remotion job', () => {
  it('snapshots files, uses fixed props for compose and preview, and produces distinct jobs', async () => {
    const first = await prepareTitleJob(title, config);
    const second = await prepareTitleJob(title, config);
    expect(first.directory).not.toBe(second.directory);
    expect(first.provenance.hash).toBe(second.provenance.hash);
    expect((await fs.stat(path.join(first.directory, 'assets/logo.png'))).mtimeMs).toBe(0);
    expect(first.provenance.renderer.browserVersion).toBe('Chromium 123.0.0');
    expect(first.inputProps.background).toBe('background.mp4');
    await fs.writeFile(title.assets.background, 'changed');
    expect(await fs.readFile(path.join(first.serveUrl, 'public/background.mp4'), 'utf8')).toBe('background.mp4');
    const full = await renderTitleJob(first, { kind: 'video' });
    const still = await renderTitleJob(first, { kind: 'still', frame: 42 });
    const range = await renderTitleJob(first, { kind: 'range', from: 30, to: 59 });
    expect(full.metadata.duration).toBe(10);
    expect(range.metadata.duration).toBe(1);
    expect(still.path).toMatch(/\.png$/);
    expect(full.provenance).toEqual(range.provenance);
    expect(full.provenance).toMatchObject({
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      compositionId: 'LeclapTitle',
    });
  });
  it('hash changes when source, props, assets or renderer config changes', async () => {
    const first = await prepareTitleJob(title, config);
    const props = await prepareTitleJob({ ...title, props: { ...title.props, headline: 'CHANGED' } }, config);
    expect(first.provenance.hash).not.toBe(props.provenance.hash);
    await fs.writeFile(title.assets.logo, 'changed logo');
    const assets = await prepareTitleJob(title, config);
    expect(first.provenance.hash).not.toBe(assets.provenance.hash);
    const browser = await prepareTitleJob(title, { ...config, browserExecutable: '/other/chrome' });
    expect(assets.provenance.hash).not.toBe(browser.provenance.hash);
  });
  it('rejects source composition metadata mismatch before rendering', async () => {
    const modules = await loadRemotion();
    (modules as any).selectComposition = async () => ({ ...composition, durationInFrames: 299 });
    await expect(prepareTitleJob(title, config)).rejects.toThrow(/1280|300|metadata/);
  });
  it('rejects a pre-aborted job', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepareTitleJob(title, config, controller.signal)).rejects.toThrow();
  });
});
