import 'reflect-metadata';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';

import { assertDescriptorSafe } from '../src/compose/descriptorGuard.js';

let mediaDir: string;
let outsideDir: string;

beforeEach(async () => {
  mediaDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-media-')));
  outsideDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'leclap-outside-')));
});

afterEach(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
  await fs.rm(outsideDir, { recursive: true, force: true });
});

// A descriptor with a single drawtext filter using the given fontfile, for the fontfile-containment
// cases. Cast through unknown because these fixtures intentionally exercise the raw filter surface.
function drawtextDescriptor(fontfile: string): TemplateDescriptor {
  return {
    sections: [
      {
        name: 'title',
        type: 'color_background',
        options: { backgroundColor: '#000', duration: 2 },
        filters: [{ type: 'drawtext', values: { text: { en: 'hi' }, fontfile } }],
      },
    ],
  } as unknown as TemplateDescriptor;
}

describe('assertDescriptorSafe', () => {
  it('allows a clean descriptor with a bundled font name', async () => {
    const result = await assertDescriptorSafe(drawtextDescriptor('BebasNeue.ttf'), mediaDir);

    expect(result.ok).toBe(true);
  });

  it('rejects a movie source filter (arbitrary file read / SSRF)', async () => {
    const descriptor = {
      sections: [{ name: 's', type: 'video', filters: [{ type: 'movie', value: '/etc/passwd' }] }],
    } as unknown as TemplateDescriptor;

    const result = await assertDescriptorSafe(descriptor, mediaDir);

    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toMatch(/movie/i);
  });

  it('rejects an amovie source filter regardless of casing/whitespace', async () => {
    const descriptor = {
      sections: [{ name: 's', type: 'video', filters: [{ type: '  AMovie ', value: 'http://169.254.169.254/' }] }],
    } as unknown as TemplateDescriptor;

    const result = await assertDescriptorSafe(descriptor, mediaDir);

    expect(result.ok).toBe(false);
  });

  it('rejects a source filter nested inside a map filter chain (recursive walk)', async () => {
    const descriptor = {
      sections: [
        {
          name: 's',
          type: 'video',
          maps: [{ inputs: ['0:v'], outputs: ['out'], filters: [{ type: 'movie', value: '/etc/hosts' }] }],
        },
      ],
    } as unknown as TemplateDescriptor;

    const result = await assertDescriptorSafe(descriptor, mediaDir);

    expect(result.ok).toBe(false);
  });

  it('rejects an absolute fontfile outside the media dir', async () => {
    const outside = path.join(outsideDir, 'evil.ttf');
    await fs.writeFile(outside, 'x');

    const result = await assertDescriptorSafe(drawtextDescriptor(outside), mediaDir);

    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toMatch(/media/i);
  });

  it('rejects a traversal fontfile that climbs out of the media dir', async () => {
    const outside = path.join(outsideDir, 'evil.ttf');
    await fs.writeFile(outside, 'x');
    const traversal = path.join(mediaDir, '..', path.basename(outsideDir), 'evil.ttf');

    const result = await assertDescriptorSafe(drawtextDescriptor(traversal), mediaDir);

    expect(result.ok).toBe(false);
  });

  it('allows an absolute fontfile contained in the media dir', async () => {
    const inside = path.join(mediaDir, 'brand.ttf');
    await fs.writeFile(inside, 'x');

    const result = await assertDescriptorSafe(drawtextDescriptor(inside), mediaDir);

    expect(result.ok).toBe(true);
  });
});
