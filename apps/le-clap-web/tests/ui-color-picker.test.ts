import { describe, it, expect } from 'vitest';
import { normalizeHex } from '../src/lib/color';

describe('normalizeHex', () => {
  it('lowercases and keeps a valid 6-digit hex', () => {
    expect(normalizeHex('#7C83FD')).toBe('#7c83fd');
  });

  it('adds a missing leading #', () => {
    expect(normalizeHex('7c83fd')).toBe('#7c83fd');
  });

  it('expands 3-digit shorthand', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('f0a')).toBe('#ff00aa');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHex('  #FFFFFF  ')).toBe('#ffffff');
  });

  it('returns null for invalid input', () => {
    expect(normalizeHex('#GGGGGG')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('#1234567')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('not-a-color')).toBeNull();
  });
});
