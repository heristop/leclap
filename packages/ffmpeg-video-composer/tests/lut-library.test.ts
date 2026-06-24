import { describe, it, expect } from 'vitest';
import { cubeFor, LUT_NAMES } from '@/editor/presets/lut-library';

describe('cubeFor', () => {
  it('returns null for an unknown LUT name', () => {
    expect(cubeFor('does-not-exist')).toBeNull();
  });

  it('emits a well-formed .cube header and N^3 data rows', () => {
    const size = 5;
    const cube = cubeFor('teal-orange', size);

    expect(cube).not.toBeNull();
    const lines = cube!.trimEnd().split('\n');
    // header comment + LUT_3D_SIZE + size^3 data rows
    expect(lines[1]).toBe('LUT_3D_SIZE 5');
    const dataRows = lines.filter((l) => /^[0-9]/.test(l));
    expect(dataRows.length).toBe(size ** 3);
  });

  it('every row is three clamped 0..1 floats', () => {
    const cube = cubeFor('vivid', 5)!;
    const dataRows = cube
      .trimEnd()
      .split('\n')
      .filter((l) => /^[0-9]/.test(l));

    for (const row of dataRows) {
      const parts = row.split(' ').map(Number);
      expect(parts).toHaveLength(3);
      for (const v of parts) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('mono maps colour to a neutral grey (r==g==b) on every row', () => {
    const cube = cubeFor('mono', 5)!;
    const dataRows = cube
      .trimEnd()
      .split('\n')
      .filter((l) => /^[0-9]/.test(l));

    for (const row of dataRows) {
      const [r, g, b] = row.split(' ');
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it('is deterministic — identical text for identical inputs', () => {
    expect(cubeFor('warm-film', 9)).toBe(cubeFor('warm-film', 9));
  });

  it('exposes the registered LUT names', () => {
    expect(LUT_NAMES).toEqual(expect.arrayContaining(['teal-orange', 'warm-film', 'mono', 'noir', 'vivid']));
  });
});
