import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { compile } from '@/index';
import { sha256Hex } from '@/core/determinism/sha256';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import { testBuildDir } from './fixtures/build-dir';

// The html-card sample's two layers as Node draws them. The phone's device check
// (apps/leclap-expo/src/services/compile/html-layer-check.ts) compares its WebView PNGs with these same
// hashes: update both together when the sample or the renderer changes.
const GOLDENS = {
  'html-8ec6d7c7f56a633c.png': '5e64ed98e22e31b55768083d183010ea40b3f0a407f29aad5eae876fd7107e5b',
  'html-89263dee28d9e7bd.png': '506c9036f95d8fe5267ebedde0f8be3e05eb5845238b0a3ac6403b775f033485',
};

const here = path.dirname(fileURLToPath(import.meta.url));
const buildDir = testBuildDir('html-card-sample');

afterAll(() => {
  fs.rmSync(buildDir, { recursive: true, force: true });
});

describe('html-card sample', () => {
  it('stages its layers with the bytes the phone check expects', async () => {
    const descriptor = JSON.parse(
      fs.readFileSync(path.resolve(here, '../../../examples/motion-design/html-card.json'), 'utf8')
    ) as TemplateDescriptor;
    const config = {
      buildDir,
      assetsDir: path.resolve(here, '../../leclap-creative-kit/src/library'),
      currentLocale: 'en',
      audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
      videoConfig: { orientation: 'landscape', scale: '1280:720' },
      fields: {},
      userVideoPaths: {},
    } as unknown as ProjectConfig;

    expect(await compile(config, descriptor)).not.toBeNull();

    const panels = path.join(buildDir, 'panels');
    const staged = Object.fromEntries(
      fs
        .readdirSync(panels)
        .filter((file) => file.startsWith('html-'))
        .map((file) => [file, sha256Hex(new Uint8Array(fs.readFileSync(path.join(panels, file))))])
    );

    expect(staged).toEqual(GOLDENS);
  }, 120_000);
});
