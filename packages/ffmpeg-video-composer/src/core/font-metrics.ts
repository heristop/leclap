// A minimal TrueType/OpenType reader: enough to measure how wide a string renders, and nothing else.
// Written in-house rather than pulling a font library because the only question asked of it is
// "how many pixels wide is this string at this size", and the answer needs two tables.
//
// Kerning is deliberately ignored. It requires `kern`/`GPOS` and almost always *narrows* a string,
// so omitting it makes every measurement slightly conservative — overflow detection errs toward
// warning rather than staying silent, which is the safe direction.

export interface FontMetrics {
  unitsPerEm: number;
  advanceWidth(codePoint: number): number;
}

interface TableRecord {
  offset: number;
  length: number;
}

function readTableDirectory(buffer: Buffer): Map<string, TableRecord> | null {
  // 12-byte offset table, then 16 bytes per table record.
  if (buffer.length < 12) {
    return null;
  }

  const numTables = buffer.readUInt16BE(4);
  const tables = new Map<string, TableRecord>();

  if (buffer.length < 12 + numTables * 16) {
    return null;
  }

  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = buffer.toString('ascii', base, base + 4);

    tables.set(tag, { offset: buffer.readUInt32BE(base + 8), length: buffer.readUInt32BE(base + 12) });
  }

  return tables;
}

interface CmapSegment {
  start: number;
  end: number;
  delta: number;
  rangeOffset: number;
  rangeOffsetFieldAddress: number;
}

// One segment's worth of code -> glyph entries. Split out of readCmapFormat4 purely to keep that
// function's statement count down; the logic is the direct format-4 lookup algorithm.
function resolveSegmentGlyphs(buffer: Buffer, segment: CmapSegment, map: Map<number, number>): void {
  const { start, end, delta, rangeOffset, rangeOffsetFieldAddress } = segment;

  for (let code = start; code <= end && code !== 0xffff; code++) {
    if (rangeOffset === 0) {
      map.set(code, (code + delta) & 0xffff);
      continue;
    }

    const glyphAddress = rangeOffsetFieldAddress + rangeOffset + (code - start) * 2;

    if (glyphAddress + 1 >= buffer.length) {
      continue;
    }

    const glyph = buffer.readUInt16BE(glyphAddress);

    map.set(code, glyph === 0 ? 0 : (glyph + delta) & 0xffff);
  }
}

// cmap format 4: the segmented mapping every Latin font ships. Other formats are not read; a font
// exposing only format 0/6/12 yields an empty map and every glyph measures zero, which the caller
// detects and treats as "no metrics".
function readCmapFormat4(buffer: Buffer, offset: number): Map<number, number> {
  const map = new Map<number, number>();
  const segCountX2 = buffer.readUInt16BE(offset + 6);
  const segCount = segCountX2 / 2;

  const endCodes = offset + 14;
  const startCodes = endCodes + segCountX2 + 2; // +2 skips reservedPad
  const idDeltas = startCodes + segCountX2;
  const idRangeOffsets = idDeltas + segCountX2;

  for (let seg = 0; seg < segCount; seg++) {
    const start = buffer.readUInt16BE(startCodes + seg * 2);
    const end = buffer.readUInt16BE(endCodes + seg * 2);

    if (start > end) {
      continue;
    }

    resolveSegmentGlyphs(
      buffer,
      {
        start,
        end,
        delta: buffer.readInt16BE(idDeltas + seg * 2),
        rangeOffset: buffer.readUInt16BE(idRangeOffsets + seg * 2),
        rangeOffsetFieldAddress: idRangeOffsets + seg * 2,
      },
      map
    );
  }

  return map;
}

function readCmap(buffer: Buffer, table: TableRecord): Map<number, number> {
  const numSubtables = buffer.readUInt16BE(table.offset + 2);

  for (let i = 0; i < numSubtables; i++) {
    const record = table.offset + 4 + i * 8;

    if (record + 8 > buffer.length) {
      continue;
    }

    const subtableOffset = table.offset + buffer.readUInt32BE(record + 4);

    if (subtableOffset + 14 > buffer.length) {
      continue;
    }

    if (buffer.readUInt16BE(subtableOffset) === 4) {
      return readCmapFormat4(buffer, subtableOffset);
    }
  }

  return new Map();
}

// hmtx holds `numberOfHMetrics` advance widths; every glyph beyond that reuses the final one
// (monospaced tails are stored this way). Returns widths in font units.
function readAdvanceWidths(buffer: Buffer, hmtx: TableRecord, numberOfHMetrics: number): number[] {
  const widths: number[] = [];

  for (let i = 0; i < numberOfHMetrics; i++) {
    const at = hmtx.offset + i * 4;

    if (at + 1 >= buffer.length) {
      break;
    }

    widths.push(buffer.readUInt16BE(at));
  }

  return widths;
}

// Accepts any Uint8Array (Buffer extends it, but a plain Uint8Array — e.g. from a caller's fetch
// or fs read — is not itself a Buffer). Wrap it once here so the byte-level helpers below can keep
// using Buffer's read*BE/toString accessors.
export function parseFontMetrics(bytes: Uint8Array): FontMetrics | null {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = readTableDirectory(buffer);

  if (!tables) {
    return null;
  }

  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');

  if (!head || !hhea || !hmtx || !cmap) {
    return null;
  }

  if (head.offset + 20 > buffer.length || hhea.offset + 36 > buffer.length || cmap.offset + 4 > buffer.length) {
    return null;
  }

  const unitsPerEm = buffer.readUInt16BE(head.offset + 18);

  if (unitsPerEm === 0) {
    return null;
  }

  const numberOfHMetrics = buffer.readUInt16BE(hhea.offset + 34);
  const widths = readAdvanceWidths(buffer, hmtx, numberOfHMetrics);
  const charToGlyph = readCmap(buffer, cmap);
  const fallback = widths.at(-1) ?? 0;

  return {
    unitsPerEm,
    advanceWidth(codePoint: number): number {
      const glyph = charToGlyph.get(codePoint);

      if (glyph === undefined) {
        return 0;
      }

      return widths[glyph] ?? fallback;
    },
  };
}

export function measureTextWidth(metrics: FontMetrics, text: string, fontSizePx: number): number {
  let units = 0;

  for (const char of text) {
    units += metrics.advanceWidth(char.codePointAt(0) as number);
  }

  return (units / metrics.unitsPerEm) * fontSizePx;
}
