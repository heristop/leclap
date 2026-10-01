import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpConfig } from '../src/config.js';
import { validateEffects, titlePropsSchema } from '../src/effects/title-registry.js';
import { probeMedia } from '../src/tools/probeMedia.js';

vi.mock('../src/tools/probeMedia.js', () => ({
  probeMedia: vi.fn(async () => ({ durationSeconds: 10, videoCodec: 'h264' })),
}));
let dir: string;
let config: McpConfig;
let template: Record<string, any>;
beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-effects-test-')));
  for (const file of ['background.mp4', 'logo.png', 'font.ttf', 'root.tsx']) {
    await fs.writeFile(path.join(dir, file), 'test');
  }
  config = {
    outputDir: dir,
    mediaDir: dir,
    renderTimeoutMs: 1000,
    allowRemotion: true,
    remotionEntry: path.join(dir, 'root.tsx'),
  };
  template = {
    global: { orientation: 'landscape', fps: 30 },
    sections: [
      {
        name: 'title',
        type: 'effect',
        options: { duration: 10 },
        effect: {
          id: 'leclap.title-reveal',
          version: '1.0.0',
          props: {},
          assets: {
            background: path.join(dir, 'background.mp4'),
            logo: path.join(dir, 'logo.png'),
            font: path.join(dir, 'font.ttf'),
          },
        },
      },
    ],
  };
  vi.mocked(probeMedia).mockResolvedValue({
    durationSeconds: 10,
    videoCodec: 'h264',
    audioCodec: null,
    sampleRate: null,
    sizeBytes: 4,
  });
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
describe('registered title effect preflight', () => {
  it('applies defaults without changing caller JSON', async () => {
    const copy = structuredClone(template);
    const prepared = await validateEffects(template, config);
    expect(prepared.get('title')?.props).toEqual({
      headline: 'LECLAP',
      headlineY: 320,
      logoDelayFrames: 15,
      entranceDurationFrames: 24,
      springDamping: 18,
    });
    expect(template).toEqual(copy);
  });
  it.each([{ allowRemotion: false }, { remotionEntry: undefined }])(
    'requires configured opt-in backend: %j',
    async (override) => {
      await expect(validateEffects(template, { ...config, ...override })).rejects.toThrow(/Remotion|remotion/);
    }
  );
  it.each([
    ['id', 'unknown'],
    ['version', '2.0.0'],
    ['props', { headline: '' }],
    ['props', { headlineY: 721 }],
    ['props', { logoDelayFrames: 290, entranceDurationFrames: 24 }],
    ['props', { source: 'return 1' }],
    ['assets', { background: 'https://host/x.mp4', logo: 'x.png', font: 'x.ttf' }],
  ])('rejects unsupported or unsafe %s', async (key, value) => {
    template.sections[0].effect[key] = value;
    await expect(validateEffects(template, config)).rejects.toThrow();
  });
  it('rejects extra assets', async () => {
    template.sections[0].effect.assets.script = path.join(dir, 'root.tsx');
    await expect(validateEffects(template, config)).rejects.toThrow();
  });
  it('rejects symlink escape', async () => {
    await fs.symlink('/etc/hosts', path.join(dir, 'escape.png'));
    template.sections[0].effect.assets.logo = path.join(dir, 'escape.png');
    await expect(validateEffects(template, config)).rejects.toThrow(/escapes/);
  });
  it.each([{ fps: 25 }, { orientation: 'portrait' }])('rejects incompatible scene output %j', async (global) => {
    template.global = { ...template.global, ...global };
    await expect(validateEffects(template, config)).rejects.toThrow(/30|landscape/);
  });
  it('rejects short background footage', async () => {
    vi.mocked(probeMedia).mockResolvedValue({
      durationSeconds: 9,
      videoCodec: 'h264',
      audioCodec: null,
      sampleRate: null,
      sizeBytes: 4,
    });
    await expect(validateEffects(template, config)).rejects.toThrow(/10/);
  });
  it('bounds every title timing property', () => {
    expect(titlePropsSchema.safeParse({ springDamping: 0 }).success).toBe(false);
    expect(titlePropsSchema.safeParse({ entranceDurationFrames: 0 }).success).toBe(false);
    expect(titlePropsSchema.safeParse({ logoDelayFrames: -1 }).success).toBe(false);
  });
});
it('resolves relative effect assets under mediaDir and rejects relative traversal', async () => {
  template.sections[0].effect.assets = { background: 'background.mp4', logo: 'logo.png', font: 'font.ttf' };
  const result = await validateEffects(template, config);
  expect(result.get('title')?.assets.logo).toBe(path.join(dir, 'logo.png'));
  template.sections[0].effect.assets.logo = '../../../etc/hosts';
  await expect(validateEffects(template, config)).rejects.toThrow();
});
