// The shared LeClap glyph table: every role points at a real part, gestures that need parts have them, and
// the drawings stay inside the 24-unit grid's language (no transforms, which a CSS gesture would override).
import { describe, expect, it } from 'vitest';
import { GLYPHS, ICON_MOTIONS, ICON_NAMES, glyphParts, hasTint, type Glyph } from '../src/icons';

const TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];

const glyphs = Object.entries(GLYPHS) as [string, Glyph][];

describe('LeClap glyphs', () => {
  it('lists every glyph once', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES.length).toBeGreaterThan(100);
  });

  it.each(glyphs)('%s: draws known shapes and names a known gesture', (_name, glyph) => {
    for (const [tag, attrs] of glyph.parts) {
      expect(TAGS).toContain(tag);
      expect(Object.values(attrs).every((value) => typeof value === 'string')).toBe(true);
    }

    if (glyph.motion !== undefined) expect(ICON_MOTIONS).toContain(glyph.motion);
  });

  it.each(glyphs)('%s: roles point at real parts', (_name, glyph) => {
    const indices = [...glyph.fill, ...(glyph.solid ?? []), ...(glyph.move ?? []), ...(glyph.move2 ?? [])];

    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(glyph.parts.length);
    }
  });

  it.each(glyphs)('%s: no part is both tinted and solid, and none carries a transform', (_name, glyph) => {
    for (const index of glyph.fill) expect(glyph.solid ?? []).not.toContain(index);

    for (const [, attrs] of glyph.parts) expect(attrs).not.toHaveProperty('transform');
  });

  it('only moves parts when the glyph has a gesture', () => {
    for (const [, glyph] of glyphs) {
      if (glyph.motion !== undefined) continue;

      expect(glyph.move).toBeUndefined();
      expect(glyph.move2).toBeUndefined();
    }
  });

  it('gives each part its paint and motion group', () => {
    const roles = glyphParts('trash').map(([, role]) => role);

    expect(roles).toEqual([
      { tint: true, solid: false, group: 0 },
      { tint: false, solid: false, group: 0 },
      { tint: false, solid: false, group: 1 },
    ]);
    expect(glyphParts('scissors').map(([, role]) => role.group)).toEqual([0, 0, 1, 2]);
    expect(glyphParts('braces').every(([, role]) => role.group === 0)).toBe(true);
  });

  it('knows which glyphs need the brand gradient', () => {
    expect(hasTint('play')).toBe(true);
    expect(hasTint('check')).toBe(false);
  });
});
