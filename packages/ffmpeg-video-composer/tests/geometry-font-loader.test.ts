import { describe, it, expect, vi } from 'vitest';
import { createBundledFontLoader } from '@/services/geometry/bundled-font-loader';
import type AbstractFilesystem from '@/platform/filesystem/AbstractFilesystem';

// Only the two methods the loader touches. Cast because the real abstract class has a large surface
// this loader neither uses nor should know about.
function fakeFilesystem(overrides: Partial<AbstractFilesystem>): AbstractFilesystem {
  return overrides as AbstractFilesystem;
}

describe('createBundledFontLoader', () => {
  it('reads the file that resolveBundledFont points at', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const readFile = vi.fn().mockResolvedValue(bytes);
    const loader = createBundledFontLoader(
      fakeFilesystem({ resolveBundledFont: vi.fn().mockResolvedValue('/fonts/Rubik.ttf'), readFile })
    );

    await expect(loader('Rubik.ttf')).resolves.toBe(bytes);
    expect(readFile).toHaveBeenCalledWith('/fonts/Rubik.ttf');
  });

  it('returns null when the font is not bundled', async () => {
    const readFile = vi.fn();
    const loader = createBundledFontLoader(
      fakeFilesystem({ resolveBundledFont: vi.fn().mockResolvedValue(null), readFile })
    );

    await expect(loader('Nope.ttf')).resolves.toBeNull();
    // Must not attempt a read when there is no path — that would throw rather than degrade.
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when resolution fails', async () => {
    const loader = createBundledFontLoader(
      fakeFilesystem({ resolveBundledFont: vi.fn().mockRejectedValue(new Error('boom')), readFile: vi.fn() })
    );

    await expect(loader('Rubik.ttf')).resolves.toBeNull();
  });

  it('returns null rather than throwing when the read fails', async () => {
    const loader = createBundledFontLoader(
      fakeFilesystem({
        resolveBundledFont: vi.fn().mockResolvedValue('/fonts/Rubik.ttf'),
        readFile: vi.fn().mockRejectedValue(new Error('disk on fire')),
      })
    );

    await expect(loader('Rubik.ttf')).resolves.toBeNull();
  });
});
