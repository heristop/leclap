import pc from 'picocolors';

// LeClap CLI visual language — "marquee / clapperboard": a calm, mostly-neutral surface with a single
// warm amber accent (the clapperboard slate / marquee bulb), used sparingly on the brand mark and on
// motion. Status colour is reserved for meaning only (green = ready, red = blocked). Deliberately
// avoids the cyan-on-dark + green/yellow/magenta rainbow that reads as generic tooling.

export const BRAND_NAME = 'LeClap';
export const BRAND_TAGLINE = 'ffmpeg video composer';

// The LeClap signature lavender — the apps' primary (`--color-brand-500`, oklch(0.663 0.178 277.9)).
// Rendered as 24-bit truecolor where supported, otherwise stepped down to the nearest xterm-256 cube
// entry (Apple Terminal et al.), then to plain ANSI magenta — so the brand reads on any terminal.
export const BRAND_RGB: readonly [number, number, number] = [124, 131, 253];

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function nearestCube(value: number): number {
  let best = 0;
  let bestDelta = Infinity;

  for (let i = 0; i < CUBE_LEVELS.length; i++) {
    const delta = Math.abs(CUBE_LEVELS[i] - value);

    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }

  return best;
}

function brandSequence(): string | null {
  if (!pc.isColorSupported) return null;

  const [r, g, b] = BRAND_RGB;
  const colorterm = process.env.COLORTERM ?? '';

  if (colorterm === 'truecolor' || colorterm === '24bit') {
    return `\x1b[38;2;${r};${g};${b}m`;
  }

  if ((process.env.TERM ?? '').includes('256')) {
    const index = 16 + 36 * nearestCube(r) + 6 * nearestCube(g) + nearestCube(b);

    return `\x1b[38;5;${index}m`;
  }

  return null; // fall back to a basic ANSI hue below
}

const BRAND_OPEN = brandSequence();

// One hue, applied with intent — never as a status signal.
export const accent = (text: string): string => {
  if (BRAND_OPEN === null) return pc.isColorSupported ? pc.magenta(text) : text;

  return `${BRAND_OPEN}${text}\x1b[39m`;
};

// The vertical film-strip edge that anchors the wordmark and reappears as the live-progress fill.
const EDGE = '▌';

export const ok = pc.green('✓');
export const bad = pc.red('✗');
export const dot = pc.dim('·');

// Wordmark: a brand-coloured film-strip edge down the left, the name in bold, the tagline dimmed
// beneath. The edge is the single vertical accent — the one thing meant to be remembered.
export function wordmark(): string {
  const edge = accent(EDGE);

  return `\n${edge} ${pc.bold(BRAND_NAME)}\n${edge} ${pc.dim(BRAND_TAGLINE)}\n`;
}

// A left-gutter status line: a dim, fixed-width label followed by its value, so successive rows align
// into a column and read as a single block rather than scattered prints.
export function statusRow(label: string, value: string): string {
  return `  ${pc.dim(label.padEnd(8))}${value}`;
}

// A timeline scrubber, not a generic bar: a played track (`━`, brand), an un-played dotted track (`┄`,
// dim) and a `◆` playhead riding the boundary — the keyframe/playhead vocabulary of a video editor.
// Pre-coloured for the live region.
export function meter(fraction: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const head = Math.round((width - 1) * clamped);

  let out = '';

  for (let i = 0; i < width; i++) {
    if (i < head) {
      out += accent('━');
      continue;
    }

    if (i === head) {
      out += accent('◆');
      continue;
    }
    out += pc.dim('┄');
  }

  return out;
}
