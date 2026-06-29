import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// theme.ts captures a brand escape (and picocolors captures colour support) at module load, so reset the
// module registry per test and re-import after setting the env. FORCE_COLOR forces picocolors on.
const ORIGINAL = { COLORTERM: process.env.COLORTERM, TERM: process.env.TERM, FORCE_COLOR: process.env.FORCE_COLOR };

describe('gradient', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.FORCE_COLOR = '1';
  });

  afterEach(() => {
    process.env.COLORTERM = ORIGINAL.COLORTERM;
    process.env.TERM = ORIGINAL.TERM;
    process.env.FORCE_COLOR = ORIGINAL.FORCE_COLOR;
  });

  it('emits a distinct 24-bit colour per character on a truecolor terminal', async () => {
    process.env.COLORTERM = 'truecolor';
    const { gradient, BRAND_RGB, BRAND_GRADIENT_RGB } = await import('../src/theme');

    const esc = String.fromCodePoint(0x1b);
    const out = gradient('LeClap');
    const stops = [...out.matchAll(new RegExp(`${esc}\\[38;2;(\\d+);(\\d+);(\\d+)m`, 'g'))];

    // One colour stop per glyph, fading from the brand lavender to the gradient pink.
    expect(stops).toHaveLength(6);
    expect(stops[0].slice(1).map(Number)).toEqual([...BRAND_RGB]);
    expect(stops[5].slice(1).map(Number)).toEqual([...BRAND_GRADIENT_RGB]);
  });

  it('falls back to the single brand hue when truecolor is unavailable', async () => {
    process.env.COLORTERM = '';
    process.env.TERM = 'xterm-256color';
    const { gradient } = await import('../src/theme');

    const esc = String.fromCodePoint(0x1b);
    const out = gradient('LeClap');

    // No per-glyph 24-bit stops — a single styled run instead.
    expect(out.match(new RegExp(`${esc}\\[38;2;`, 'g'))).toBeNull();
    expect(out).toContain('LeClap');
  });
});
