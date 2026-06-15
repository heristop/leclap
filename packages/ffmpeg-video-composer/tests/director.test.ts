import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { compile, FFmpegNodeAdapter } from '@/index';

// Template fixtures load via the `@` alias (-> packages/ffmpeg-video-composer/src). Directory paths the engine
// reads from disk (assets, build output) resolve relative to this test file so the suite runs
// the same whether invoked from the repo root or from the core package.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const buildDir = path.resolve(repoRoot, 'build');
const assetsDir = path.resolve(repoRoot, 'packages/creative-kit/src/assets');

// Project Configuration
const projectConfig: ProjectConfig = {
  buildDir,
  assetsDir,
  currentLocale: 'en',
  audioConfig: {
    sampleRate: 44100,
    channelLayout: 'stereo',
  },
  videoConfig: {
    orientation: 'landscape',
    scale: '1280:720',
  },
  fields: {
    form_1_firstname: 'Emily',
    form_1_lastname: 'Parker',
    form_1_job: 'Frontend Developer',
    form_2_keyword1: 'php',
    form_2_keyword2: 'javascript',
    form_2_keyword3: 'typescript',
    form_2_keyword4: 'caffeine',
    form_3_keyword1: 'remote',
  },
};

// The sample templates point their assets at this repo's GitHub raw URLs (so a user copying a
// template gets working media). For the integration suite we rewrite those to the identical files
// shipped under the local assets dir: the run stays fully hermetic — no network, no flakiness, and
// it still exercises the whole compile pipeline (segments, filters, maps, concat, music). The
// local-file fetch path enforces a staging-dir guard, and these paths sit under `assetsDir`.
const RAW_ASSET_PREFIX = 'https://github.com/heristop/ffmpeg-video-composer/raw/main/';
const localRawPath = (relative: string): string => {
  if (relative.startsWith('src/shared/assets/')) {
    return path.join(repoRoot, 'packages/creative-kit/src/assets', relative.slice('src/shared/assets/'.length));
  }

  if (relative.startsWith('src/shared/library/')) {
    return path.join(repoRoot, 'packages/creative-kit/src/library', relative.slice('src/shared/library/'.length));
  }

  return path.join(repoRoot, relative);
};

const localizeAsset = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.startsWith(RAW_ASSET_PREFIX) ? localRawPath(value.slice(RAW_ASSET_PREFIX.length)) : value;
  }

  if (Array.isArray(value)) {
    return value.map(localizeAsset);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, localizeAsset(val)]));
  }

  return value;
};

async function runTemplateCompilation(configName: string): Promise<string | null> {
  const raw = (await import(`./fixtures/${configName}.json`)).default;
  const template = localizeAsset(raw) as TemplateDescriptor;

  return await compile(projectConfig, template);
}

describe('Segments', () => {
  it('should compile a picture section', async () => {
    expect(await runTemplateCompilation('picture')).not.toBeNull();
  }, 40000);

  it('should compile a video section from url successfully', async () => {
    expect(await runTemplateCompilation('video')).not.toBeNull();
  }, 40000);

  it('should compile an intertitle section with animation successfully', async () => {
    expect(await runTemplateCompilation('intertitle')).not.toBeNull();
  }, 40000);

  it('should compile a color_background section with a gradient layer successfully', async () => {
    expect(await runTemplateCompilation('gradient')).not.toBeNull();
  }, 40000);

  it('should compile a video section with a looped sound successfully', async () => {
    expect(await runTemplateCompilation('loop-music')).not.toBeNull();
  }, 40000);

  it('should compile a portrait video section', async () => {
    expect(await runTemplateCompilation('portrait')).not.toBeNull();
  }, 40000);

  it('should compile an accelerated video section', async () => {
    expect(await runTemplateCompilation('video-speed')).not.toBeNull();
  }, 40000);

  it('should compile a video with a local music', async () => {
    expect(await runTemplateCompilation('local-music')).not.toBeNull();
  }, 40000);

  it('should compile and concat background color sections', async () => {
    expect(await runTemplateCompilation('fast-and-curious')).not.toBeNull();
  }, 40000);
});

describe('Concat', () => {
  it('should concat several video sections with music mix', async () => {
    expect(await runTemplateCompilation('concat-videos-with-music')).not.toBeNull();
  }, 80000);
});

describe('Mixed Template', () => {
  it('should compile a mixed template successfully', async () => {
    // The CLI entry main() is covered directly in main-entry.test.ts; here we just exercise the
    // mixed sample template through the compile pipeline (cwd-independent).
    expect(await runTemplateCompilation('sample')).not.toBeNull();
  }, 100000);
});

describe('Transitions (end-to-end)', () => {
  // End-to-end proof for the transition pipeline: one render exercises section transition
  // (wipeleft xfade), a global.transition default (fade), kenburns motion + cinematic look on an
  // image_background, color_background layers (solid + gradient), global.audio loudnorm, and a
  // bundled music track. A non-cut boundary forces the assembleWithTransitions (xfade) path rather
  // than plain concat, so a non-null result confirms xfade assembly + normalize + music windows
  // compose together.
  it('should compile a transitions template through the xfade assembly path', async () => {
    const output = await runTemplateCompilation('transitions');
    expect(output).not.toBeNull();

    // Timeline math: Σ(section durations) − Σ(non-cut boundary durations).
    // 3 sections × 4s = 12s; boundaries: wipeleft 0.3s + global fade 0.5s = 0.8s → 11.2s expected.
    const sectionTotal = 4 + 4 + 4;
    const transitionTotal = 0.3 + 0.5;
    const expectedDuration = sectionTotal - transitionTotal;

    const ffmpeg = new FFmpegNodeAdapter();
    const info = await ffmpeg.getInfos(output as string);
    expect(info.duration).not.toBeNull();

    const probed = info.duration as number;
    expect(Math.abs(probed - expectedDuration)).toBeLessThanOrEqual(0.3);
  }, 120000);
});
