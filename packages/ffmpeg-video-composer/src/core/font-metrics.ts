// A minimal TrueType/OpenType reader: enough to measure how wide a string renders, and nothing else.
// Written in-house rather than pulling a font library because the only question asked of it is
// "how many pixels wide is this string at this size", and the answer needs two tables.
//
// Kerning is deliberately ignored. It requires `kern`/`GPOS` and almost always *narrows* a string,
// so omitting it makes every measurement slightly conservative — overflow detection errs toward
// warning rather than staying silent, which is the safe direction.
//
// Built on DataView/Uint8Array rather than Node's Buffer: this module is reached from the browser
// and React Native entry points (via TemplateValidator), and neither environment provides the
// `Buffer` global — using it here would throw `ReferenceError: Buffer is not defined` at load time.

export interface FontMetrics {
  unitsPerEm: number;
  advanceWidth(codePoint: number): number;
}

interface TableRecord {
  offset: number;
  length: number;
}

// 4-byte ASCII table tag. Built from code points rather than TextDecoder: table tags are ASCII by
// spec, and String.fromCodePoint needs no runtime API beyond the language itself.
function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCodePoint(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function readTableDirectory(view: DataView, bytes: Uint8Array): Map<string, TableRecord> | null {
  // 12-byte offset table, then 16 bytes per table record.
  if (view.byteLength < 12) {
    return null;
  }

  const numTables = view.getUint16(4, false);
  const tables = new Map<string, TableRecord>();

  if (view.byteLength < 12 + numTables * 16) {
    return null;
  }

  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = readTag(bytes, base);

    tables.set(tag, { offset: view.getUint32(base + 8, false), length: view.getUint32(base + 12, false) });
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
function resolveSegmentGlyphs(view: DataView, segment: CmapSegment, map: Map<number, number>): void {
  const { start, end, delta, rangeOffset, rangeOffsetFieldAddress } = segment;

  for (let code = start; code <= end && code !== 0xffff; code++) {
    if (rangeOffset === 0) {
      map.set(code, (code + delta) & 0xffff);
      continue;
    }

    const glyphAddress = rangeOffsetFieldAddress + rangeOffset + (code - start) * 2;

    if (glyphAddress + 1 >= view.byteLength) {
      continue;
    }

    const glyph = view.getUint16(glyphAddress, false);

    map.set(code, glyph === 0 ? 0 : (glyph + delta) & 0xffff);
  }
}

// cmap format 4: the segmented mapping every Latin font ships. Other formats are not read; a font
// exposing only format 0/6/12 yields an empty map and every glyph measures zero, which the caller
// detects and treats as "no metrics".
function readCmapFormat4(view: DataView, offset: number): Map<number, number> {
  const map = new Map<number, number>();
  const segCountX2 = view.getUint16(offset + 6, false);
  const segCount = segCountX2 / 2;

  const endCodes = offset + 14;
  const startCodes = endCodes + segCountX2 + 2; // +2 skips reservedPad
  const idDeltas = startCodes + segCountX2;
  const idRangeOffsets = idDeltas + segCountX2;

  for (let seg = 0; seg < segCount; seg++) {
    const start = view.getUint16(startCodes + seg * 2, false);
    const end = view.getUint16(endCodes + seg * 2, false);

    if (start > end) {
      continue;
    }

    resolveSegmentGlyphs(
      view,
      {
        start,
        end,
        delta: view.getInt16(idDeltas + seg * 2, false),
        rangeOffset: view.getUint16(idRangeOffsets + seg * 2, false),
        rangeOffsetFieldAddress: idRangeOffsets + seg * 2,
      },
      map
    );
  }

  return map;
}

function readCmap(view: DataView, table: TableRecord): Map<number, number> {
  const numSubtables = view.getUint16(table.offset + 2, false);

  for (let i = 0; i < numSubtables; i++) {
    const record = table.offset + 4 + i * 8;

    if (record + 8 > view.byteLength) {
      continue;
    }

    const subtableOffset = table.offset + view.getUint32(record + 4, false);

    if (subtableOffset + 14 > view.byteLength) {
      continue;
    }

    if (view.getUint16(subtableOffset, false) === 4) {
      return readCmapFormat4(view, subtableOffset);
    }
  }

  return new Map();
}

// hmtx holds `numberOfHMetrics` advance widths; every glyph beyond that reuses the final one
// (monospaced tails are stored this way). Returns widths in font units.
function readAdvanceWidths(view: DataView, hmtx: TableRecord, numberOfHMetrics: number): number[] {
  const widths: number[] = [];

  for (let i = 0; i < numberOfHMetrics; i++) {
    const at = hmtx.offset + i * 4;

    if (at + 1 >= view.byteLength) {
      break;
    }

    widths.push(view.getUint16(at, false));
  }

  return widths;
}

// Accepts any Uint8Array (a Node Buffer included, since Buffer extends Uint8Array — but this
// module never depends on that; it only ever touches the Uint8Array/DataView surface). A DataView
// is constructed over the exact byteOffset/byteLength of the input rather than its `.buffer`
// directly, because a Uint8Array may be a view into a larger, shared ArrayBuffer — reading from
// `.buffer` alone would read the right bytes at the wrong place whenever byteOffset isn't 0.
export function parseFontMetrics(bytes: Uint8Array): FontMetrics | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = readTableDirectory(view, bytes);

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

  if (head.offset + 20 > view.byteLength || hhea.offset + 36 > view.byteLength || cmap.offset + 4 > view.byteLength) {
    return null;
  }

  const unitsPerEm = view.getUint16(head.offset + 18, false);

  if (unitsPerEm === 0) {
    return null;
  }

  const numberOfHMetrics = view.getUint16(hhea.offset + 34, false);
  const widths = readAdvanceWidths(view, hmtx, numberOfHMetrics);
  const charToGlyph = readCmap(view, cmap);
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
