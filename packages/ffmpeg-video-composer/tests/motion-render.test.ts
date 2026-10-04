import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import type { RenderManifest } from '@/core/determinism/manifest';
import { TemplateValidator } from '@/services/TemplateValidator';
import { X264_COLOR_PARAMS, buildColorMetadataArgs } from '@/core/encoding';
import { testBuildDir } from './fixtures/build-dir';

// The motion system study (examples/motion-design/spring-kinetics.json) through real FFmpeg: every
// spring, bezier, token and track must parse in FFmpeg's own expression evaluator, render twice to the
// same bytes, and keep its compiled graph stable (golden).

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const example = path.resolve(repoRoot, 'examples/motion-design/spring-kinetics.json');
const libDir = path.resolve(repoRoot, 'packages/leclap-creative-kit/src/library');
const buildDir = testBuildDir('motion-render');

const descriptor = JSON.parse(fs.readFileSync(example, 'utf8')) as TemplateDescriptor;

const config = {
  buildDir,
  assetsDir: libDir,
  currentLocale: 'en',
  audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
  videoConfig: { orientation: 'landscape', scale: '1280:720' },
} as unknown as ProjectConfig;

// These goldens record a real render, whose colour-tag flags follow the local FFmpeg version (libx264
// params from 7.1, see core/encoding.ts). Fold them back to one spelling so the golden is the same on
// every FFmpeg the suite runs against.
function graphGolden(manifest: RenderManifest): string {
  return `${manifest.graph.commands.join('\n').replaceAll(X264_COLOR_PARAMS, buildColorMetadataArgs())}\n`;
}

async function render(): Promise<{ bytes: Buffer; manifest: RenderManifest }> {
  let manifest: RenderManifest | undefined;
  const output = await compile(config, descriptor, { onManifest: (m) => (manifest = m) });

  expect(output).not.toBeNull();

  return { bytes: fs.readFileSync(output as string), manifest: manifest as RenderManifest };
}

describe('motion system example', () => {
  it('validates cleanly', () => {
    const result = new TemplateValidator().validateTemplate(descriptor);

    expect(result.errors ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('renders through FFmpeg twice to identical bytes', async () => {
    const first = await render();
    const second = await render();

    expect(second.bytes.equals(first.bytes)).toBe(true);
    expect(first.manifest.deterministic).toBe(true);
    await expect(graphGolden(first.manifest)).toMatchFileSnapshot('__goldens__/motion/spring-kinetics.txt');
  }, 240000);

  it('lowers every curve to plain expression arithmetic (no tokens left, bounded size)', async () => {
    const { manifest } = await render();
    const commands = manifest.graph.commands.join('\n');

    expect(commands).not.toContain('$land');
    expect(commands).not.toMatch(/spring\(|cubic-bezier\(/);
    expect(commands).toMatch(/fontsize='200\*\(/);

    for (const command of manifest.graph.commands) {
      for (const option of command.match(/'[^']*'/g) ?? []) expect(option.length).toBeLessThan(6000);
    }
  }, 240000);
});

// P2: every kinetic preset through real FFmpeg (examples/motion-design/kinetic-type.json).
describe('kinetic typography example', () => {
  const kinetic = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, 'examples/motion-design/kinetic-type.json'), 'utf8')
  ) as TemplateDescriptor;

  async function renderKinetic(): Promise<{ bytes: Buffer; manifest: RenderManifest }> {
    let manifest: RenderManifest | undefined;
    const output = await compile(config, kinetic, { onManifest: (m) => (manifest = m) });

    expect(output).not.toBeNull();

    return { bytes: fs.readFileSync(output as string), manifest: manifest as RenderManifest };
  }

  it('validates cleanly', () => {
    expect(new TemplateValidator().validateTemplate(kinetic).errors ?? []).toEqual([]);
  });

  it('renders twice to identical bytes, with a stable graph', async () => {
    const first = await renderKinetic();
    const second = await renderKinetic();

    expect(second.bytes.equals(first.bytes)).toBe(true);
    await expect(graphGolden(first.manifest)).toMatchFileSnapshot('__goldens__/motion/kinetic-type.txt');
  }, 240000);
});

// Camera, graphics and designed transitions through real FFmpeg (examples/motion-design/camera-and-graphics.json).
describe('camera and graphics example', () => {
  const effects = JSON.parse(
    fs.readFileSync(path.resolve(repoRoot, 'examples/motion-design/camera-and-graphics.json'), 'utf8')
  ) as TemplateDescriptor;

  it('validates and renders twice to identical bytes, with a stable graph', async () => {
    expect(new TemplateValidator().validateTemplate(effects).errors ?? []).toEqual([]);

    async function renderEffects(): Promise<{ bytes: Buffer; manifest: RenderManifest }> {
      let manifest: RenderManifest | undefined;
      const output = await compile(config, effects, { onManifest: (m) => (manifest = m) });

      expect(output).not.toBeNull();

      return { bytes: fs.readFileSync(output as string), manifest: manifest as RenderManifest };
    }

    // Sequential: both renders share the build directory.
    const runs = [await renderEffects()];
    runs.push(await renderEffects());

    expect(runs[1].bytes.equals(runs[0].bytes)).toBe(true);
    await expect(graphGolden(runs[0].manifest)).toMatchFileSnapshot('__goldens__/motion/camera-and-graphics.txt');
  }, 300000);
});
