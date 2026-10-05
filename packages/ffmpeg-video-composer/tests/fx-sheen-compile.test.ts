import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '@/index';
import type { ProjectConfig, TemplateDescriptor } from '@/core/types';
import type { RenderManifest } from '@/core/determinism/manifest';
import { TemplateValidator } from '@/services/TemplateValidator';
import { testBuildDir } from './fixtures/build-dir';

// The sheen through the whole compile path: the rounded mask sprite is generated and staged by the asset
// stage, the section is promoted to a complex graph for its extra input, and two renders are identical.

const config = {
  buildDir: testBuildDir('fx-sheen-compile'),
  currentLocale: 'en',
  audioConfig: { sampleRate: 44100, channelLayout: 'stereo' },
  videoConfig: { orientation: 'landscape', scale: '640:360' },
} as unknown as ProjectConfig;

const card = { x: 'iw*0.2', y: 'ih*0.25', w: 'iw*0.6', h: 'ih*0.5' };

function descriptor(): TemplateDescriptor {
  return {
    global: { orientation: 'landscape', musicEnabled: false, seed: 7, fps: 25 },
    sections: [
      {
        name: 'card',
        type: 'color_background',
        options: { backgroundColor: '#121826', duration: 1.4, layers: [{ color: '#7F8BA3', ...card }] },
        graphics: [{ type: 'fx', effect: 'sheen', at: 0.2, target: { ...card, radius: 20 }, color: '$color.fg' }],
        kinetic: [{ text: { en: 'SHINE' }, preset: 'fade', size: 90 }],
      },
      {
        name: 'title',
        type: 'color_background',
        options: { backgroundColor: '#303845', duration: 1 },
        kinetic: [{ text: { en: 'GLOW' }, preset: 'fade', size: 120 }],
        graphics: [{ type: 'fx', effect: 'sheen', target: 'text:0', profile: 'twin', repeat: 2, every: 0.5 }],
      },
    ],
  } as unknown as TemplateDescriptor;
}

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });

    return true;
  } catch {
    return false;
  }
}

async function render(): Promise<{ bytes: Buffer; commands: string }> {
  let manifest: RenderManifest | undefined;
  const output = await compile(config, descriptor(), { onManifest: (m) => (manifest = m) });

  return { bytes: fs.readFileSync(output as string), commands: manifest?.graph.commands.join('\n') ?? '' };
}

describe.skipIf(!hasFfmpeg())('fx sheen compile', () => {
  it('validates cleanly', () => {
    expect(new TemplateValidator().validateTemplate(descriptor()).errors ?? []).toEqual([]);
  });

  it('renders a rounded-card and a text-target sheen twice to identical bytes', async () => {
    const first = await render();
    const second = await render();

    expect(second.bytes.equals(first.bytes)).toBe(true);
    expect(first.commands).toContain('gradients=s=');
    expect(first.commands).toMatch(/sprite-mask-[0-9a-f]{8}\.png/);
    expect(first.commands).toContain('alphamerge');
    expect(first.commands).toContain('eof_action=pass');
  }, 240000);
});
