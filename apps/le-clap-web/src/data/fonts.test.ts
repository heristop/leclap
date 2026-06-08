import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { FONTS } from '@ffmpeg-video-composer/core/src/shared/library/fonts.ts';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');

describe('FONTS', () => {
  it('has unique ids', () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FONTS)('$id ships a non-empty TTF under public/fonts', (entry) => {
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.cssFamily.length).toBeGreaterThan(0);
    expect(entry.file.endsWith('.ttf')).toBe(true);
    const filePath = resolve(publicDir, 'fonts', entry.file);
    expect(existsSync(filePath), `missing file: ${filePath}`).toBe(true);
    expect(readFileSync(filePath).length).toBeGreaterThan(0);
  });
});
