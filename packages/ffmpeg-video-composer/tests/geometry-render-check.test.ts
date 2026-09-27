import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { renderedGeometryWarnings } from '@/index';
import { runRenderCheck, type RenderEngine } from '@/services/geometry/render-check';
import { FFmpegAvailability } from '@/platform/ffmpeg/FFmpegDetector';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

const execFileAsync = promisify(execFile);

// Everything here is generated: colour cards and a lavfi-made picture, no LFS media, so the suite runs
// in any checkout with an FFmpeg that has drawtext on PATH.
function template(sections: Record<string, unknown>[]): TemplateDescriptor {
  return { global: { orientation: 'landscape', musicEnabled: false }, sections } as unknown as TemplateDescriptor;
}

function caption(color: string): Record<string, unknown> {
  return { text: { en: 'Measured from pixels' }, style: 'subtle', color };
}

function card(name: string, backgroundColor: string, textColor: string): Record<string, unknown> {
  return { type: 'color_background', name, options: { duration: 2, backgroundColor }, caption: caption(textColor) };
}

function picture(name: string, file: string, textColor: string): Record<string, unknown> {
  return {
    type: 'image_background',
    name,
    options: { duration: 2, pictureUrl: `pictures/${file}` },
    caption: caption(textColor),
  };
}

let assetsDir = '';

beforeAll(async () => {
  assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'render-check-assets-'));
  await fs.mkdir(path.join(assetsDir, 'pictures'));

  for (const color of ['black', 'white']) {
    await execFileAsync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=1280x720`,
      '-frames:v',
      '1',
      path.join(assetsDir, 'pictures', `${color}.png`),
    ]);
  }
});

afterAll(async () => {
  await fs.rm(assetsDir, { recursive: true, force: true });
});

describe('renderedGeometryWarnings (real render)', () => {
  it('measures near-white text on a white card from pixels, replacing the colour-token finding', async () => {
    const result = await renderedGeometryWarnings(template([card('pale', '#ffffff', '#eeeeee')]), { assetsDir });

    expect(result.unavailable).toBeUndefined();
    expect(result.measured).toBe(1);
    expect(result.warnings.map((w) => w.code)).toEqual(['text_low_contrast_rendered']);
    expect(result.warnings[0]).toMatchObject({ path: 'sections[0].caption', approx: false });
    expect(result.warnings[0].message).toMatch(/renders at 1\.[0-2]:1/);
  }, 60_000);

  it('reports nothing for white text on a black card', async () => {
    const result = await renderedGeometryWarnings(template([card('dark', '#000000', '#ffffff')]), { assetsDir });

    expect(result.measured).toBe(1);
    expect(result.warnings).toEqual([]);
  }, 60_000);

  // The static model cannot see into a picture: both captions get the same "over footage" finding.
  // Rendered, the one over black reads and the one over white does not.
  it('settles text over a picture either way', async () => {
    const descriptor = template([picture('night', 'black.png', '#ffffff'), picture('snow', 'white.png', '#ffffff')]);
    const result = await renderedGeometryWarnings(descriptor, { assetsDir });

    expect(result.measured).toBe(2);
    expect(result.warnings.map((w) => [w.code, w.path])).toEqual([
      ['text_low_contrast_rendered', 'sections[1].caption'],
    ]);
  }, 60_000);
});

describe('runRenderCheck when it cannot render', () => {
  const descriptor = template([card('pale', '#ffffff', '#eeeeee')]);

  it('falls back to the static findings without a native FFmpeg, and says so', async () => {
    const engine: RenderEngine = {
      compile: () => Promise.reject(new Error('must not render')),
      detect: () => Promise.resolve({ availability: FFmpegAvailability.WASM }),
    };
    const result = await runRenderCheck(descriptor, {}, engine);

    expect(result.unavailable).toMatch(/native FFmpeg/);
    expect(result.measured).toBe(0);
    expect(result.warnings.map((w) => w.code)).toEqual(['text_low_contrast']);
  });

  it('reports the engine’s own error when the render fails', async () => {
    const engine: RenderEngine = {
      compile: (_config, _template, reporter) => {
        reporter?.onLog?.({ level: 'error', message: "No such filter: 'drawtext'\nstack…" });

        return Promise.resolve(null);
      },
      detect: () => Promise.resolve({ availability: FFmpegAvailability.SYSTEM }),
    };
    const result = await runRenderCheck(descriptor, { workDir: os.tmpdir() }, engine);

    expect(result.unavailable).toBe("render failed: No such filter: 'drawtext'");
    expect(result.warnings.map((w) => w.code)).toEqual(['text_low_contrast']);
  });

  it('does not render a template with no text to measure', async () => {
    const engine: RenderEngine = {
      compile: () => Promise.reject(new Error('must not render')),
      detect: () => Promise.reject(new Error('must not detect')),
    };
    const bare = template([
      { type: 'color_background', name: 'plain', options: { duration: 1, backgroundColor: '#000' } },
    ]);

    expect(await runRenderCheck(bare, {}, engine)).toEqual({ warnings: [], measured: 0 });
  });
});
