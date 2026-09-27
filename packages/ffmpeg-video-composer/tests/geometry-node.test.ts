import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { cachedFontLoader, createNodeFontLoader, nodeGeometryWarnings } from '@/services/geometry/node-geometry';
import { fontAssetUrl } from '@/core/asset-source';
import type AbstractFilesystem from '@/platform/filesystem/AbstractFilesystem';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

function fakeFilesystem(overrides: Partial<AbstractFilesystem>): AbstractFilesystem {
  return {
    resolveBundledFont: vi.fn().mockResolvedValue(null),
    readFile: vi.fn(),
    fetch: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AbstractFilesystem;
}

describe('createNodeFontLoader', () => {
  it('prefers a bundled font and never touches the network', async () => {
    const bytes = new Uint8Array([1]);
    const fetch = vi.fn();
    const loader = createNodeFontLoader(
      fakeFilesystem({
        resolveBundledFont: vi.fn().mockResolvedValue('/fonts/Oswald.ttf'),
        readFile: vi.fn().mockResolvedValue(bytes),
        fetch,
      })
    );

    await expect(loader('Oswald.ttf')).resolves.toBe(bytes);
    expect(fetch).not.toHaveBeenCalled();
  });

  // A published install ships no fonts, so this is the path every `pnpm dlx @leclap/cli validate`
  // takes — the same catalog URL the renderer's AssetManager stages from.
  it('falls back to the catalog fetch the renderer uses when nothing is bundled', async () => {
    const bytes = new Uint8Array([2]);
    const readFile = vi.fn().mockResolvedValue(bytes);
    const unlink = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue('/tmp/Oswald.ttf');
    const loader = createNodeFontLoader(fakeFilesystem({ readFile, fetch, unlink }));

    await expect(loader('Oswald.ttf')).resolves.toBe(bytes);
    expect(fetch).toHaveBeenCalledWith(fontAssetUrl('Oswald.ttf'));
    expect(readFile).toHaveBeenCalledWith('/tmp/Oswald.ttf');
    expect(unlink).toHaveBeenCalledWith('/tmp/Oswald.ttf');
  });

  it('does not fetch a file the catalog does not know', async () => {
    const fetch = vi.fn();
    const loader = createNodeFontLoader(fakeFilesystem({ fetch }));

    await expect(loader('Helvetica.ttf')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('degrades to null when offline', async () => {
    const loader = createNodeFontLoader(fakeFilesystem({ fetch: vi.fn().mockRejectedValue(new Error('ENOTFOUND')) }));

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

    await expect(nodeGeometryWarnings({} as TemplateDescriptor, { validator })).resolves.toEqual([]);
    expect(stderr).toHaveBeenCalledWith('geometry checks skipped: boom\n');

    stderr.mockRestore();
  });

  it('hands the validator the loader it was given', async () => {
    const loadFont = vi.fn();
    const validator = { getGeometryWarnings: vi.fn().mockResolvedValue([]) };
    const descriptor = { sections: [] } as unknown as TemplateDescriptor;

    await nodeGeometryWarnings(descriptor, { validator, loadFont });

    expect(validator.getGeometryWarnings).toHaveBeenCalledWith(descriptor, loadFont);
  });
});
