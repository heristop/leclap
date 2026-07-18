import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { parsePanelUrl, panelFileName, roundedPanelPng, type PanelSpec } from '@/editor/presets/rounded-panel';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// Read a big-endian uint32 out of a Uint8Array — used to walk PNG chunks in the tests.
const readU32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

// Standard PNG CRC32 (0xEDB88320) — recomputed independently to validate the encoder's chunk CRCs.
const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
};

// Walk the chunk stream and return every chunk's type, data slice and stored CRC.
interface Chunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

const parseChunks = (png: Uint8Array): Chunk[] => {
  const chunks: Chunk[] = [];
  let offset = 8; // skip signature
  while (offset < png.length) {
    const length = readU32(png, offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = readU32(png, offset + 8 + length);
    chunks.push({ type, data, crc });
    offset += 12 + length;
  }

  return chunks;
};

// Decode a whole PNG produced by the encoder into a flat RGBA pixel buffer using Node zlib (test-only).
const decodePng = (png: Uint8Array): { width: number; height: number; pixels: Uint8Array } => {
  const chunks = parseChunks(png);
  const ihdr = chunks.find((c) => c.type === 'IHDR')!;
  const width = readU32(ihdr.data, 0);
  const height = readU32(ihdr.data, 4);

  const idatParts = chunks.filter((c) => c.type === 'IDAT').map((c) => c.data);
  const totalIdat = idatParts.reduce((sum, part) => sum + part.length, 0);
  const zlibStream = new Uint8Array(totalIdat);
  let cursor = 0;
  for (const part of idatParts) {
    zlibStream.set(part, cursor);
    cursor += part.length;
  }

  const raw = new Uint8Array(inflateSync(zlibStream));

  // Strip the leading filter byte on every row (encoder uses filter 0 / None).
  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1) + 1;
    pixels.set(raw.subarray(rowStart, rowStart + stride), y * stride);
  }

  return { width, height, pixels };
};

const pixelAt = (
  decoded: { width: number; pixels: Uint8Array },
  x: number,
  y: number
): [number, number, number, number] => {
  const i = (y * decoded.width + x) * 4;

  return [decoded.pixels[i], decoded.pixels[i + 1], decoded.pixels[i + 2], decoded.pixels[i + 3]];
};

describe('roundedPanelPng', () => {
  const spec: PanelSpec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };

  it('begins with the 8-byte PNG signature', () => {
    const png = roundedPanelPng(spec);
    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_SIGNATURE);
  });

  it('encodes IHDR with the requested dimensions, 8-bit depth and colour type 6', () => {
    const png = roundedPanelPng(spec);
    const ihdr = parseChunks(png).find((c) => c.type === 'IHDR')!;
    expect(readU32(ihdr.data, 0)).toBe(380);
    expect(readU32(ihdr.data, 4)).toBe(150);
    expect(ihdr.data[8]).toBe(8); // bit depth
    expect(ihdr.data[9]).toBe(6); // colour type RGBA
  });

  it('carries valid per-chunk CRC32s and an inflatable IDAT stream', () => {
    const png = roundedPanelPng(spec);
    const chunks = parseChunks(png);
    for (const chunk of chunks) {
      const typeAndData = new Uint8Array(4 + chunk.data.length);
      typeAndData[0] = chunk.type.charCodeAt(0);
      typeAndData[1] = chunk.type.charCodeAt(1);
      typeAndData[2] = chunk.type.charCodeAt(2);
      typeAndData[3] = chunk.type.charCodeAt(3);
      typeAndData.set(chunk.data, 4);
      expect(chunk.crc).toBe(crc32(typeAndData));
    }
    // inflate must succeed without throwing
    expect(() => decodePng(png)).not.toThrow();
  });

  it('paints a solid centre pixel at the requested colour and opacity', () => {
    const png = roundedPanelPng(spec);
    const decoded = decodePng(png);
    const [r, g, b, a] = pixelAt(decoded, spec.width / 2, spec.height / 2);
    expect([r, g, b]).toEqual([0x0a, 0x0f, 0x14]);
    expect(a).toBe(Math.round(spec.opacity * 255));
  });

  it('leaves the extreme corner pixel fully transparent', () => {
    const png = roundedPanelPng(spec);
    const decoded = decodePng(png);
    const [, , , a] = pixelAt(decoded, 0, 0);
    expect(a).toBe(0);
  });

  it('keeps straight edges at full base alpha (corner AA only affects corners)', () => {
    const png = roundedPanelPng(spec);
    const decoded = decodePng(png);
    const [r, g, b, a] = pixelAt(decoded, Math.floor(spec.width / 2), 0);
    expect([r, g, b]).toEqual([0x0a, 0x0f, 0x14]);
    expect(a).toBe(Math.round(spec.opacity * 255));
  });

  it('is deterministic — byte-identical output for identical specs', () => {
    const a = roundedPanelPng(spec);
    const b = roundedPanelPng(spec);
    expect(a).toEqual(b);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('parsePanelUrl', () => {
  it('parses every key from a full panel URL', () => {
    const spec = parsePanelUrl('panel:w=380,h=150,r=28,c=0a0f14,o=0.72');
    expect(spec).toEqual({ width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 });
  });

  it('applies defaults for missing radius, colour and opacity', () => {
    const spec = parsePanelUrl('panel:w=200,h=100');
    expect(spec).toEqual({ width: 200, height: 100, radius: 24, color: '0a0f14', opacity: 0.72 });
  });

  it('is order-independent', () => {
    const spec = parsePanelUrl('panel:o=0.5,c=ffffff,h=100,r=10,w=200');
    expect(spec).toEqual({ width: 200, height: 100, radius: 10, color: 'ffffff', opacity: 0.5 });
  });

  it('returns null for a non-panel scheme', () => {
    expect(parsePanelUrl('https://example.com/x.png')).toBeNull();
    expect(parsePanelUrl('lut:teal-orange')).toBeNull();
  });

  it('returns null when width or height is missing or non-positive', () => {
    expect(parsePanelUrl('panel:h=100')).toBeNull();
    expect(parsePanelUrl('panel:w=200')).toBeNull();
    expect(parsePanelUrl('panel:w=0,h=100')).toBeNull();
    expect(parsePanelUrl('panel:w=200,h=-5')).toBeNull();
  });

  it('clamps radius to half of the smaller dimension', () => {
    const spec = parsePanelUrl('panel:w=100,h=40,r=999');
    expect(spec?.radius).toBe(20); // floor(min(100,40)/2)
  });

  it('clamps opacity into 0..1', () => {
    expect(parsePanelUrl('panel:w=10,h=10,o=5')?.opacity).toBe(1);
    expect(parsePanelUrl('panel:w=10,h=10,o=-3')?.opacity).toBe(0);
  });

  it('strips a leading # from the colour', () => {
    expect(parsePanelUrl('panel:w=10,h=10,c=#abcdef')?.color).toBe('abcdef');
  });

  it('rejects a sub-pixel or oversized dimension', () => {
    expect(parsePanelUrl('panel:w=0.5,h=100')).toBeNull();
    expect(parsePanelUrl('panel:w=200,h=0.9')).toBeNull();
    expect(parsePanelUrl('panel:w=50000,h=100')).toBeNull();
  });

  it('normalises colour — expands 3-digit shorthand, defaults malformed or empty', () => {
    expect(parsePanelUrl('panel:w=10,h=10,c=fff')?.color).toBe('ffffff');
    expect(parsePanelUrl('panel:w=10,h=10,c=f00')?.color).toBe('ff0000');
    expect(parsePanelUrl('panel:w=10,h=10,c=xyz123')?.color).toBe('0a0f14');
    expect(parsePanelUrl('panel:w=10,h=10,c=')?.color).toBe('0a0f14');
  });
});

describe('panelFileName', () => {
  it('produces a stable, spec-derived filename', () => {
    const spec: PanelSpec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };
    expect(panelFileName(spec)).toBe('panel-380x150-r28-0a0f14-o72.png');
  });

  it('gives different names to different specs', () => {
    const a: PanelSpec = { width: 380, height: 150, radius: 28, color: '0a0f14', opacity: 0.72 };
    const b: PanelSpec = { width: 200, height: 100, radius: 10, color: 'ffffff', opacity: 0.5 };
    expect(panelFileName(a)).not.toBe(panelFileName(b));
  });
});

describe('roundedPanelPng defensiveness (direct PanelSpec)', () => {
  it('floors non-integer dimensions and clamps an over-large radius into a valid, painted PNG', () => {
    // A spec built directly (bypassing parsePanelUrl's floor/clamp) with a fractional width and a
    // radius larger than half the shorter side must still produce a fully-painted PNG: no fractional
    // stride silently dropping every scanline after the first, no overlapping corner regions.
    const decoded = decodePng(roundedPanelPng({ width: 30.7, height: 30, radius: 999, color: 'ffffff', opacity: 1 }));

    expect(decoded.width).toBe(30);
    expect(decoded.height).toBe(30);
    // A late-row centre pixel is painted — the fractional-stride bug would leave it zero (transparent).
    const [r, g, b, a] = pixelAt(decoded, 15, 15);
    expect([r, g, b]).toEqual([255, 255, 255]);
    expect(a).toBeGreaterThan(0);
  });
});
