import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCompose } from '../src/tools/composeVideo.js';
import { registerRenderPreview } from '../src/tools/renderPreview.js';
import { registerGetEffectSchema } from '../src/tools/getEffectSchema.js';
import { registerValidateTemplate } from '../src/tools/validateTemplate.js';
import { templateRevision } from '../src/effects/template-revision.js';
import { runRender } from '../src/compose/renderRunner.js';
import type * as ComposerModule from 'ffmpeg-video-composer';
import { nodeGeometryWarnings } from 'ffmpeg-video-composer';
import { runTitleEffect } from '../src/effects/effect-runner.js';

vi.mock('ffmpeg-video-composer', async (importOriginal) => ({
  ...(await importOriginal<typeof ComposerModule>()),
  nodeGeometryWarnings: vi.fn(async () => []),
}));
vi.mock('../src/compose/renderRunner.js', () => ({ runRender: vi.fn(), runGeometryCheck: vi.fn() }));
vi.mock('../src/tools/probeMedia.js', () => ({
  probeMedia: async () => ({ durationSeconds: 10, videoCodec: 'h264' }),
}));
vi.mock('../src/effects/effect-runner.js', () => ({ runTitleEffect: vi.fn() }));
let dir: string;
let cfg: any;
let template: any;
function capture(register: any) {
  let handler: any;
  register(
    {
      registerTool: (_name: any, _meta: any, cb: any) => {
        handler = cb;
      },
    },
    cfg
  );
  return handler;
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(nodeGeometryWarnings).mockResolvedValue([]);
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-effect-tool-test-')));
  for (const file of ['background.mp4', 'logo.png', 'font.ttf', 'entry.tsx', 'clip.mp4', 'still.png']) {
    await fs.writeFile(path.join(dir, file), file === 'still.png' ? Buffer.from([137, 80, 78, 71]) : 'test');
  }
  cfg = {
    mediaDir: dir,
    outputDir: dir,
    allowRemotion: true,
    remotionEntry: path.join(dir, 'entry.tsx'),
    renderTimeoutMs: 1000,
  };
  template = {
    global: { orientation: 'landscape', fps: 30, musicEnabled: false },
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
  vi.mocked(runTitleEffect).mockImplementation(async (_title, _config, requests) => ({
    directory: dir,
    provenance: { hash: 'snapshot' } as never,
    results: requests.map((request) => ({
      path: path.join(dir, request.kind === 'still' ? 'still.png' : 'clip.mp4'),
      metadata: { duration: request.kind === 'video' ? 10 : 1 },
      provenance: { hash: 'snapshot' },
    })),
  }));
  vi.mocked(runRender).mockResolvedValue({
    ok: true,
    outputPath: path.join(dir, 'out/output.mp4'),
    durationSeconds: 10,
    sizeBytes: 4,
    videoCodec: 'h264',
    audioCodec: null,
  });
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
describe('MCP registered effects', () => {
  it('compose lowers effect to clip with provenance and leaves authored template unchanged', async () => {
    const raw = structuredClone(template);
    const result = await capture(registerCompose)({ template });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.effectProvenance.title.provenance.hash).toBe('snapshot');
    const [job] = vi.mocked(runRender).mock.calls[0];
    expect(job.template.sections?.[0].type).toBe('project_video');
    expect(job.projectConfig.userVideoPaths).toEqual({ title: path.join(dir, 'clip.mp4') });
    expect(template).toEqual(raw);
  });
  it('invalid later effect rejects before any Remotion rendering', async () => {
    template.sections.push({
      ...structuredClone(template.sections[0]),
      name: 'later',
      effect: { ...structuredClone(template.sections[0].effect), props: { springDamping: 0 } },
    });
    const result = await capture(registerCompose)({ template });
    expect(result.isError).toBe(true);
    expect(runTitleEffect).not.toHaveBeenCalled();
    expect(runRender).not.toHaveBeenCalled();
  });
  it('missing ordinary clip rejects before probing effect assets', async () => {
    template.sections.push({ name: 'ordinary', type: 'project_video', options: { duration: 2 } });
    const result = await capture(registerCompose)({ template });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ordinary');
    expect(runTitleEffect).not.toHaveBeenCalled();
  });
  it('rejects manual binding collision with an effect', async () => {
    const result = await capture(registerCompose)({ template, userVideoPaths: { title: path.join(dir, 'clip.mp4') } });
    expect(result.isError).toBe(true);
    expect(runTitleEffect).not.toHaveBeenCalled();
  });
  it('preview returns readable images and uses the same job for all requested frames', async () => {
    const result = await capture(registerRenderPreview)({ template, section: 'title', frames: [0, 42, 299] });
    expect(result.isError).toBeUndefined();
    expect(result.content.filter((block: any) => block.type === 'image')).toEqual(
      Array(3).fill({ type: 'image', mimeType: 'image/png', data: 'iVBORw==' })
    );
    expect(runTitleEffect).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runTitleEffect).mock.calls[0][2]).toEqual([
      { kind: 'still', frame: 0 },
      { kind: 'still', frame: 42 },
      { kind: 'still', frame: 299 },
    ]);
  });
  it('range preview returns a video resource link', async () => {
    const result = await capture(registerRenderPreview)({
      template,
      section: 'title',
      frameRange: { from: 0, to: 29 },
    });
    expect(result.content.find((block: any) => block.type === 'resource_link')).toMatchObject({
      mimeType: 'video/mp4',
    });
  });
  it.each([
    { frames: [0, 0] },
    { frames: [300] },
    { frameRange: { from: 0, to: 90 } },
    { frames: [0], frameRange: { from: 0, to: 1 } },
    {},
  ])('rejects invalid preview selection %j', async (selection) => {
    const result = await capture(registerRenderPreview)({ template, section: 'title', ...selection });
    expect(result.isError).toBe(true);
    expect(runTitleEffect).not.toHaveBeenCalled();
  });
  it('stale revision rejects before work', async () => {
    const result = await capture(registerRenderPreview)({
      template,
      section: 'title',
      frames: [0],
      expectedRevision: 'stale',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('revision_conflict');
    expect(runTitleEffect).not.toHaveBeenCalled();
  });
  it('validate returns raw JSON revision and acknowledges unmeasured Remotion text', async () => {
    template.metadata = { custom: 'preserve' };
    const result = await capture(registerValidateTemplate)({ template, render: true });
    expect(result.structuredContent.revision).toBe(templateRevision(template));
    expect(result.structuredContent.render.measured).toBe(0);
    expect(result.content[0].text).toMatch(/Remotion.*not measured/);
    expect(runTitleEffect).not.toHaveBeenCalled();
  });
  it('effect schema exposes defaults and backend limitations', async () => {
    const result = await capture(registerGetEffectSchema)({});
    expect(result.structuredContent.id).toBe('leclap.title-reveal');
    expect(result.structuredContent.props.properties.headline.default).toBe('LECLAP');
    expect(result.structuredContent.output).toMatchObject({ width: 1280, height: 720, fps: 30, durationInFrames: 300 });
  });
});
it('preview artifact size failure cleans the complete job', async () => {
  const file = path.join(dir, 'still.png');
  const handle = await fs.open(file, 'w');
  await handle.truncate(11 * 1024 * 1024);
  await handle.close();
  const result = await capture(registerRenderPreview)({ template, section: 'title', frames: [0] });
  expect(result.isError).toBe(true);
  await expect(fs.stat(dir)).rejects.toThrow();
});
it('compose cleans temporary effect files and retains provenance', async () => {
  await fs.mkdir(path.join(dir, 'bundle'));
  await fs.writeFile(path.join(dir, 'bundle', 'source.js'), 'source');
  await fs.writeFile(path.join(dir, 'provenance.json'), '{}');
  const result = await capture(registerCompose)({ template });
  expect(result.isError).toBeUndefined();
  expect(await fs.readdir(dir)).toEqual(['provenance.json']);
});

it('maps only top-level authored geometry indices after omitting effects', async () => {
  vi.mocked(nodeGeometryWarnings).mockResolvedValue([
    { path: 'sections[0].caption', message: 'top-level', approx: false },
    { path: 'partials[0].sections[0].caption', message: 'partial', approx: false },
  ] as never);
  template.sections.push({ name: 'outro', type: 'color_background', options: { duration: 2 } });
  const result = await capture(registerValidateTemplate)({ template });
  expect(result.structuredContent.geometry).toContain('sections[1].caption: top-level');
  expect(result.structuredContent.geometry).toContain('partials[0].sections[0].caption: partial');
});
