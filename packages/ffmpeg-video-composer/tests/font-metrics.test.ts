import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFontMetrics, measureTextWidth } from '@/core/font-metrics';

const currentDir = dirname(fileURLToPath(import.meta.url));
// Rubik is the engine's DEFAULT_FONT_ID and already lives in creative-kit; the assertions below
// are ratios, not absolute pixel counts, so any bundled .ttf would work equally well.
const fontPath = join(currentDir, '../../leclap-creative-kit/src/library/fonts/Rubik.ttf');

// A hand-built, minimal sfnt buffer: a structurally valid table directory (offset table +
// head/hhea/hmtx/cmap records) that parses far enough to reach readCmap, but whose cmap record's
// offset points past the end of the buffer. head/hhea/hmtx are laid out with real, in-bounds data
// so parseFontMetrics gets past every earlier guard and only the cmap read is exercised.
function bufferWithOutOfBoundsCmap(): Buffer {
  const buffer = Buffer.alloc(132);

  buffer.writeUInt16BE(4, 4); // numTables

  const writeRecord = (index: number, tag: string, offset: number, length: number): void => {
    const base = 12 + index * 16;

    buffer.write(tag, base, 'ascii');
    buffer.writeUInt32BE(offset, base + 8);
    buffer.writeUInt32BE(length, base + 12);
  };

  writeRecord(0, 'head', 76, 20);
  writeRecord(1, 'hhea', 96, 36);
  writeRecord(2, 'hmtx', 132, 0);
  writeRecord(3, 'cmap', 9999, 0); // out of bounds: buffer is only 132 bytes long

  buffer.writeUInt16BE(1000, 76 + 18); // head.unitsPerEm
  buffer.writeUInt16BE(0, 96 + 34); // hhea.numberOfHMetrics — 0, so hmtx is never read

  return buffer;
}

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

  it('returns null rather than throwing when the cmap record points past the end of the buffer', () => {
    const buffer = bufferWithOutOfBoundsCmap();

    expect(() => parseFontMetrics(buffer)).not.toThrow();
    expect(parseFontMetrics(buffer)).toBeNull();
  });
});
