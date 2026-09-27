import 'reflect-metadata';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registerValidateTemplate } from '../src/tools/validateTemplate.js';

// Same fake-server trick as compose-video.test: capture the registered handler and call it directly.
type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
}>;

let mediaDir = '';
let outputDir = '';

beforeAll(async () => {
  mediaDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-validate-media-')));
  outputDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-validate-out-')));
});

afterAll(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
  await fs.rm(outputDir, { recursive: true, force: true });
});

function setup(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerValidateTemplate(fakeServer as never, { mediaDir, outputDir });

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

describe('validate_template handler', () => {
  it('validates an inline descriptor and reports no clips/fields for a color card', async () => {
    // A pure color card — no project_video clips, no form fields.
    const template: Record<string, unknown> = {
      global: { orientation: 'landscape' },
      sections: [{ name: 'card', type: 'color_background', options: { backgroundColor: '#0b0f14', duration: 3 } }],
    };
    const result = await setup()({ template });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: [], formFields: [] });
    expect(result.structuredContent?.sectionCount).toBeGreaterThan(0);
    expect(result.structuredContent?.geometry).toBeUndefined();
  });

  it('rejects an invalid inline template with a summarized message', async () => {
    const result = await setup()({ template: { sections: 'not-an-array' } });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid template');
  });

  // Regression guard: a project_video declared inside a `{type:'partial'}` section must surface in
  // requiredClips — the engine expands partials before rendering, so compose_video WILL demand a
  // clip for it, and this tool used to report no clips at all for such templates.
  it('lists a partial-provided project_video section in requiredClips', async () => {
    const template: Record<string, unknown> = {
      partials: [{ id: 'cam', sections: [{ name: 'clip', type: 'project_video', options: { duration: 3 } }] }],
      sections: [{ type: 'partial', ref: 'cam' }],
    };
    const result = await setup()({ template });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: ['clip'] });
  });
});

describe('validate_template with render: true', () => {
  const pale: Record<string, unknown> = {
    global: { orientation: 'landscape' },
    sections: [
      {
        name: 'card',
        type: 'color_background',
        options: { backgroundColor: '#ffffff', duration: 2 },
        caption: { text: { en: 'Pale on white' }, style: 'subtle', color: '#eeeeee' },
      },
    ],
  };

  it('measures the caption from a real render and says so', async () => {
    const result = await setup()({ template: pale, render: true });
    const render = result.structuredContent?.render as { measured: number; unavailable?: string };

    expect(render.unavailable).toBeUndefined();
    expect(render.measured).toBe(1);
    expect(result.structuredContent?.geometry).toEqual([
      expect.stringMatching(/^sections\[0\]\.caption: .* renders at 1\.[0-2]:1/),
    ]);
    expect(result.content[0].text).toContain('Rendered check measured 1 text(s) from pixels');
    // The scratch render is cleaned up; nothing is left in the output dir.
    expect(await fs.readdir(outputDir)).toEqual([]);
  }, 60_000);

  it('does not render unless asked', async () => {
    const result = await setup()({ template: pale });

    expect(result.structuredContent?.render).toBeUndefined();
    expect(result.structuredContent?.geometry).toEqual([expect.stringContaining('#eeeeee on #ffffff is 1.2:1')]);
  });

  // It renders what compose_video would, so it refuses what compose_video would refuse.
  it('does not render a descriptor that escapes the media sandbox', async () => {
    const escaping: Record<string, unknown> = {
      sections: [
        {
          name: 'card',
          type: 'color_background',
          options: { backgroundColor: '#000000', duration: 2 },
          filters: [{ type: 'curves', value: 'psfile=/etc/passwd' }],
        },
      ],
    };
    const result = await setup()({ template: escaping, render: true });
    const render = result.structuredContent?.render as { measured: number; unavailable?: string };

    expect(render.measured).toBe(0);
    expect(render.unavailable).toMatch(/^not rendered: /);
  });
});
