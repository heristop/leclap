import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFontMetrics, measureTextWidth } from '@/core/font-metrics';

const currentDir = dirname(fileURLToPath(import.meta.url));
// Rubik is the engine's DEFAULT_FONT_ID and already lives in creative-kit; the assertions below
// are ratios, not absolute pixel counts, so any bundled .ttf would work equally well.
const fontPath = join(currentDir, '../../leclap-creative-kit/src/library/fonts/Rubik.ttf');

describe('font metrics', () => {
  it('returns null for a buffer that is not a font', () => {
    expect(parseFontMetrics(Buffer.from('not a font at all'))).toBeNull();
  });

  it('reads a plausible unitsPerEm', () => {
    const metrics = parseFontMetrics(readFileSync(fontPath));

    expect(metrics).not.toBeNull();
    // Every real TTF uses a power of two here, almost always 1000, 1024 or 2048.
    expect(metrics!.unitsPerEm).toBeGreaterThanOrEqual(16);
    expect(metrics!.unitsPerEm).toBeLessThanOrEqual(16384);
  });

  it('measures a wider string as wider', () => {
    const metrics = parseFontMetrics(readFileSync(fontPath))!;

    const short = measureTextWidth(metrics, 'ii', 48);
    const long = measureTextWidth(metrics, 'WWWWWWWW', 48);

    expect(long).toBeGreaterThan(short);
  });

  it('scales linearly with font size', () => {
    const metrics = parseFontMetrics(readFileSync(fontPath))!;

    const at24 = measureTextWidth(metrics, 'Hello world', 24);
    const at48 = measureTextWidth(metrics, 'Hello world', 48);

    expect(at48).toBeCloseTo(at24 * 2, 5);
  });

  it('treats an unmapped code point as zero rather than throwing', () => {
    const metrics = parseFontMetrics(readFileSync(fontPath))!;

    expect(() => measureTextWidth(metrics, '\u{10FFFF}', 48)).not.toThrow();
  });
});
