import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cachedFontLoader,
  createNodeFontLoader,
  nodeGeometryWarnings,
  type NodeFontSource,
} from '@/services/geometry/node-geometry';
import { fontAssetUrl } from '@/core/asset-source';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

const oswald = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../leclap-creative-kit/src/library/fonts/Oswald.ttf')
);

function fakeFilesystem(overrides: Partial<NodeFontSource>): NodeFontSource {
  return {
    resolveBundledFont: vi.fn().mockResolvedValue(null),
    readFile: vi.fn(),
    fetchBytes: vi.fn(),
    ...overrides,
  } as unknown as NodeFontSource;
}

describe('createNodeFontLoader', () => {
  it('prefers a bundled font and never touches the network', async () => {
    const bytes = new Uint8Array([1]);
    const fetchBytes = vi.fn();
    const loader = createNodeFontLoader(
      fakeFilesystem({
        resolveBundledFont: vi.fn().mockResolvedValue('/fonts/Oswald.ttf'),
        readFile: vi.fn().mockResolvedValue(bytes),
        fetchBytes,
      })
    );

    await expect(loader('Oswald.ttf')).resolves.toBe(bytes);
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  // A published install ships no fonts, so this is the path every `pnpm dlx @leclap/cli validate`
  // takes — the same catalog URL the renderer's AssetManager stages from, but read into memory under
  // a deadline rather than through the temp file a concurrent render stages the same font with.
  it('falls back to a bounded in-memory download of the catalog URL when nothing is bundled', async () => {
    const fetchBytes = vi.fn().mockResolvedValue(oswald);
    const loader = createNodeFontLoader(fakeFilesystem({ fetchBytes }));

    await expect(loader('Oswald.ttf')).resolves.toBe(oswald);
    expect(fetchBytes).toHaveBeenCalledWith(
      fontAssetUrl('Oswald.ttf'),
      expect.objectContaining({ timeoutMs: expect.any(Number), maxBytes: expect.any(Number) })
    );
  });

  // cachedFontLoader keeps a success for the life of an MCP server, so a captive-portal page or an
  // empty body must come back as a miss, not as bytes.
  it('refuses a download that is not a font', async () => {
    const page = new TextEncoder().encode('<!doctype html><title>Sign in to the network</title>');
    const loader = createNodeFontLoader(fakeFilesystem({ fetchBytes: vi.fn().mockResolvedValue(page) }));

    await expect(loader('Oswald.ttf')).resolves.toBeNull();
  });

  it('does not fetch a file the catalog does not know', async () => {
    const fetchBytes = vi.fn();
    const loader = createNodeFontLoader(fakeFilesystem({ fetchBytes }));

    await expect(loader('Helvetica.ttf')).resolves.toBeNull();
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it('degrades to null when offline', async () => {
    const loader = createNodeFontLoader(
      fakeFilesystem({ fetchBytes: vi.fn().mockRejectedValue(new Error('ENOTFOUND')) })
    );

    await expect(loader('Oswald.ttf')).resolves.toBeNull();
  });
});

describe('cachedFontLoader', () => {
  it('reads a font once per process', async () => {
    const inner = vi.fn().mockResolvedValue(new Uint8Array([1]));
    const loader = cachedFontLoader(inner);

    await loader('Oswald.ttf');
    await loader('Oswald.ttf');

    expect(inner).toHaveBeenCalledTimes(1);
  });

  // One transient miss must not pin the process to estimates until restart.
  it('retries after a miss or a rejection', async () => {
    const inner = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('EMFILE'))
      .mockResolvedValue(new Uint8Array([1]));
    const loader = cachedFontLoader(inner);

    await expect(loader('Oswald.ttf')).resolves.toBeNull();
    await expect(loader('Oswald.ttf')).rejects.toThrow('EMFILE');
    await expect(loader('Oswald.ttf')).resolves.toEqual(new Uint8Array([1]));
  });
});

describe('nodeGeometryWarnings', () => {
  it('degrades a checker failure to no findings and says so on stderr', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const validator = { getGeometryWarnings: vi.fn().mockRejectedValue(new Error('boom')) };

    try {
      await expect(nodeGeometryWarnings({} as TemplateDescriptor, { validator })).resolves.toEqual([]);
      expect(stderr).toHaveBeenCalledWith('geometry checks skipped: boom\n');
    } finally {
      stderr.mockRestore();
    }
  });

  it('hands the validator the loader it was given', async () => {
    const loadFont = vi.fn();
    const validator = { getGeometryWarnings: vi.fn().mockResolvedValue([]) };
    const descriptor = { sections: [] } as unknown as TemplateDescriptor;

    await nodeGeometryWarnings(descriptor, { validator, loadFont });

    expect(validator.getGeometryWarnings).toHaveBeenCalledWith(descriptor, loadFont);
  });

  // The default loader's adapter never logs, so building it must not depend on LECLAP_LOG_LEVEL: a
  // value pino rejects ('off') used to throw inside the degrade path and drop every finding.
  it('still reports findings when LECLAP_LOG_LEVEL is not a level pino knows', async () => {
    const tiny = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: 3 }, caption: { text: { en: 'Hi' }, fontsize: 8 } },
      ],
    } as unknown as TemplateDescriptor;

    vi.stubEnv('LECLAP_LOG_LEVEL', 'off');

    try {
      const warnings = await nodeGeometryWarnings(tiny);

      expect(warnings.map((warning) => warning.code)).toContain('text_too_small');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
