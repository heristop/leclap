// ---------------------------------------------------------------------------
// Rounded-panel PNG generator — caption-panel overlays without a runtime image lib
// ---------------------------------------------------------------------------
//
// Text-sugar captions want a soft rounded backdrop behind them. Rather than ship a binary PNG per
// size/colour and stage it across three filesystems, the engine GENERATES the panel image at compile
// time and writes it to the build FS (uniform on Node, Expo and the browser/WASM virtual FS). Like the
// LUT library it mirrors, the output is a pure, deterministic function of a small spec — unit-tested to
// the byte. The catch: the engine also runs on React-Native/Hermes, which has no `Buffer` and no
// `zlib`, so the PNG is hand-encoded with plain `Uint8Array` math and DEFLATE *stored* (uncompressed)
// blocks — no npm deps, no Node built-ins.

/** A rounded caption panel: a `width`×`height` box, `radius`-corner, filled with `color` at `opacity`. */
export interface PanelSpec {
  width: number;
  height: number;
  radius: number;
  /** 6-hex RGB string WITHOUT a leading `#`, e.g. `'0a0f14'`. */
  color: string;
  /** 0..1 straight alpha applied to the whole fill. */
  opacity: number;
}

const DEFAULT_RADIUS = 24;
const DEFAULT_COLOR = '0a0f14';
const DEFAULT_OPACITY = 0.72;
// Upper bound on a panel edge. A caption panel is at most a video frame wide; this ceiling rejects a
// runaway `w=`/`h=` before it reaches the per-pixel allocation (a 50000² panel is ~10 GB) — matters
// most on the memory-constrained WASM/Hermes targets.
const MAX_DIMENSION = 8192;

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

const inPixelRange = (n: number): boolean => Number.isFinite(n) && n >= 1 && n <= MAX_DIMENSION;

// Normalise a `c=` value to a 6-hex-digit RGB string. Accepts an optional leading `#` and 3-digit CSS
// shorthand (expanded, e.g. `fff` → `ffffff`); anything malformed or empty falls back to the default
// instead of nibble-misaligning a short string into a silently-wrong colour.
const normalizeColor = (raw: string | undefined): string => {
  if (raw === undefined) {
    return DEFAULT_COLOR;
  }

  const hex = (raw.startsWith('#') ? raw.slice(1) : raw).toLowerCase();

  if (/^[0-9a-f]{6}$/.test(hex)) {
    return hex;
  }

  if (/^[0-9a-f]{3}$/.test(hex)) {
    return hex.replace(/./g, (c) => c + c);
  }

  return DEFAULT_COLOR;
};

/**
 * Parses a `panel:` overlay URL — comma-separated `key=value` pairs after the scheme, order-independent,
 * e.g. `panel:w=380,h=150,r=28,c=0a0f14,o=0.72`. Width and height are required and must be positive;
 * radius, colour and opacity fall back to defaults. Radius is clamped so the corners never overlap and
 * opacity is clamped to 0..1. Returns null for any non-`panel:` string or a missing/invalid size.
 */
export function parsePanelUrl(url: string): PanelSpec | null {
  if (!url.startsWith('panel:')) {
    return null;
  }

  const body = url.slice('panel:'.length);
  const pairs = new Map<string, string>();
  for (const part of body.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      continue;
    }
    pairs.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }

  // Floor before the range check: a sub-pixel `w=0.5` must be rejected, not silently floored to a
  // zero-dimension PNG that every decoder treats as corrupt.
  const width = Math.floor(Number(pairs.get('w')));
  const height = Math.floor(Number(pairs.get('h')));
  if (!inPixelRange(width) || !inPixelRange(height)) {
    return null;
  }

  const rawRadius = pairs.has('r') ? Number(pairs.get('r')) : DEFAULT_RADIUS;
  const radius = Number.isFinite(rawRadius) ? rawRadius : DEFAULT_RADIUS;

  const rawOpacity = pairs.has('o') ? Number(pairs.get('o')) : DEFAULT_OPACITY;
  const opacity = Number.isFinite(rawOpacity) ? clamp(rawOpacity, 0, 1) : DEFAULT_OPACITY;

  const maxRadius = Math.floor(Math.min(width, height) / 2);

  return {
    width,
    height,
    radius: clamp(Math.floor(radius), 0, maxRadius),
    color: normalizeColor(pairs.get('c')),
    opacity,
  };
}

/**
 * A deterministic cache filename for a spec, e.g. `panel-380x150-r28-0a0f14-o72.png` (opacity as an
 * integer percent). Identical specs map to one filename so the build can reuse a staged panel.
 */
export function panelFileName(spec: PanelSpec): string {
  const pct = Math.round(spec.opacity * 100);

  return `panel-${spec.width}x${spec.height}-r${spec.radius}-${spec.color}-o${pct}.png`;
}

// Parse one channel of a 6-hex colour string; a malformed digit collapses to 0 rather than NaN.
const hexByte = (hex: string, at: number): number => {
  const value = parseInt(hex.slice(at, at + 2), 16);

  return Number.isFinite(value) ? value : 0;
};

/**
 * Analytic coverage for a pixel centre inside a rounded rectangle. Straight edges and the interior read
 * full (1); only a corner's outer region tapers, via the signed distance to that corner's arc centre —
 * `clamp(radius - dist + 0.5)` gives a 1px anti-aliased edge.
 */
const cornerCoverage = (cx: number, cy: number, spec: PanelSpec): number => {
  const { width, height, radius } = spec;
  if (radius <= 0) {
    return 1;
  }

  // The arc centre of whichever corner this pixel sits in; null when the pixel is on a straight run.
  let arcX = 0;
  let arcY = 0;
  let inCorner = false;

  if (cx < radius && cy < radius) {
    arcX = radius;
    arcY = radius;
    inCorner = true;
  }
  if (cx > width - radius && cy < radius) {
    arcX = width - radius;
    arcY = radius;
    inCorner = true;
  }
  if (cx < radius && cy > height - radius) {
    arcX = radius;
    arcY = height - radius;
    inCorner = true;
  }
  if (cx > width - radius && cy > height - radius) {
    arcX = width - radius;
    arcY = height - radius;
    inCorner = true;
  }

  if (!inCorner) {
    return 1;
  }

  const dist = Math.hypot(cx - arcX, cy - arcY);

  return clamp(radius - dist + 0.5, 0, 1);
}; // straight alpha, no premultiplication

// Build the raw (unfiltered-minus-filter-byte) RGBA scanlines: one filter-type byte 0 per row, then
// width*4 straight-alpha RGBA bytes.
const rawImageBytes = (spec: PanelSpec): Uint8Array => {
  const { width, height, color, opacity } = spec;
  const r = hexByte(color, 0);
  const g = hexByte(color, 2);
  const b = hexByte(color, 4);
  const baseAlpha = Math.round(clamp(opacity, 0, 1) * 255);

  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const coverage = cornerCoverage(x + 0.5, y + 0.5, spec);
      const i = rowStart + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = Math.round(baseAlpha * coverage);
    }
  }

  return raw;
};

// CRC32 table for the standard PNG polynomial 0xEDB88320, built once at module load.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(c & 1);
      c = (c >>> 1) ^ (0xedb88320 & mask);
    }
    table[n] = c >>> 0;
  }

  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

// Adler32 over the raw image bytes — the zlib stream's trailing checksum.
const adler32 = (data: Uint8Array): number => {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }

  return ((b << 16) | a) >>> 0;
};

// Wrap raw bytes in a minimal zlib stream (0x78 0x01) using DEFLATE *stored* blocks — no compression,
// so no Hermes zlib dependency. Each block carries ≤65535 bytes; the final block sets BFINAL.
const zlibStore = (raw: Uint8Array): Uint8Array => {
  const MAX_BLOCK = 0xffff;
  const blockCount = Math.max(1, Math.ceil(raw.length / MAX_BLOCK));
  // 2 header bytes + per block (1 flag + 2 LEN + 2 NLEN) + payload + 4 adler bytes.
  const out = new Uint8Array(2 + blockCount * 5 + raw.length + 4);
  let pos = 0;

  out[pos++] = 0x78;
  out[pos++] = 0x01;

  for (let offset = 0; offset < raw.length || offset === 0; offset += MAX_BLOCK) {
    const len = Math.min(MAX_BLOCK, raw.length - offset);
    const isFinal = offset + len >= raw.length;
    out[pos++] = isFinal ? 1 : 0; // BFINAL, BTYPE=00 (stored)
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(offset, offset + len), pos);
    pos += len;
    if (isFinal) {
      break;
    }
  }

  const checksum = adler32(raw);
  out[pos++] = (checksum >>> 24) & 0xff;
  out[pos++] = (checksum >>> 16) & 0xff;
  out[pos++] = (checksum >>> 8) & 0xff;
  out[pos++] = checksum & 0xff;

  return out;
};

// Encode one PNG chunk: length (uint32 BE) + type + data + CRC32(type+data) (uint32 BE).
const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    typeBytes[i] = type.charCodeAt(i);
  }

  const typeAndData = new Uint8Array(4 + data.length);
  typeAndData.set(typeBytes, 0);
  typeAndData.set(data, 4);
  const crc = crc32(typeAndData);

  const out = new Uint8Array(12 + data.length);
  out[0] = (data.length >>> 24) & 0xff;
  out[1] = (data.length >>> 16) & 0xff;
  out[2] = (data.length >>> 8) & 0xff;
  out[3] = data.length & 0xff;
  out.set(typeAndData, 4);
  out[8 + data.length] = (crc >>> 24) & 0xff;
  out[9 + data.length] = (crc >>> 16) & 0xff;
  out[10 + data.length] = (crc >>> 8) & 0xff;
  out[11 + data.length] = crc & 0xff;

  return out;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }

  return out;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Generates the RGBA PNG bytes for a rounded panel — colour type 6, 8-bit depth, straight alpha with
 * 1px anti-aliased corners. Pure and deterministic: the same spec always yields byte-identical output.
 */
export function roundedPanelPng(input: PanelSpec): Uint8Array {
  // Normalise the generator's own inputs so a directly-built PanelSpec (not routed through
  // parsePanelUrl) can't break scanline framing or the corner math: integer dimensions ≥1, and a
  // radius capped at half the shorter side so two corner regions never overlap and fight (the
  // "corners never overlap" contract the module documents but parsePanelUrl alone enforced).
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const radius = clamp(Math.floor(input.radius), 0, Math.floor(Math.min(width, height) / 2));
  const spec: PanelSpec = { ...input, width, height, radius };

  const ihdr = new Uint8Array(13);
  ihdr[0] = (spec.width >>> 24) & 0xff;
  ihdr[1] = (spec.width >>> 16) & 0xff;
  ihdr[2] = (spec.width >>> 8) & 0xff;
  ihdr[3] = spec.width & 0xff;
  ihdr[4] = (spec.height >>> 24) & 0xff;
  ihdr[5] = (spec.height >>> 16) & 0xff;
  ihdr[6] = (spec.height >>> 8) & 0xff;
  ihdr[7] = spec.height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  const idat = zlibStore(rawImageBytes(spec));

  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
