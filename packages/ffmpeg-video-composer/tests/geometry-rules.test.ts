import { describe, it, expect } from 'vitest';
import { overflowWarnings, legibilityWarnings, collisionWarnings } from '@/services/geometry/rules';
import type { Box } from '@/services/geometry/text-boxes';

const canvas = { width: 1280, height: 720 };

function box(overrides: Partial<Box> = {}): Box {
  return {
    path: 'sections[0].caption',
    label: 'Section "a" caption',
    x: 100,
    y: 500,
    width: 200,
    height: 48,
    startSec: 0,
    endSec: 5,
    approx: false,
    ...overrides,
  };
}

describe('overflowWarnings', () => {
  it('says nothing about a box inside the frame', () => {
    expect(overflowWarnings([box()], canvas)).toEqual([]);
  });

  it('reports a box wider than the usable width', () => {
    const warnings = overflowWarnings([box({ x: 40, width: 1300 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_overflow');
    expect(warnings[0].severity).toBe('warn');
  });

  it('reports a box running off the right edge', () => {
    const warnings = overflowWarnings([box({ x: 1200, width: 300 })], canvas);

    expect(warnings[0].code).toBe('text_out_of_frame');
  });

  it('carries the approximate flag through to the warning', () => {
    const warnings = overflowWarnings([box({ x: 40, width: 1300, approx: true })], canvas);

    expect(warnings[0].approx).toBe(true);
  });
});

describe('legibilityWarnings', () => {
  it('accepts type at a readable size', () => {
    expect(legibilityWarnings([box({ height: 48 })], canvas)).toEqual([]);
  });

  it('flags type below the readable floor', () => {
    // height is fontSize × 1.2, so 12px of height is a 10px font on a 720px canvas.
    const warnings = legibilityWarnings([box({ height: 12 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_too_small');
  });
});

describe('collisionWarnings', () => {
  it('says nothing about boxes that never share the screen', () => {
    const a = box({ path: 'sections[0].caption', startSec: 0, endSec: 2 });
    const b = box({ path: 'sections[1].caption', startSec: 3, endSec: 5 });

    expect(collisionWarnings([a, b])).toEqual([]);
  });

  it('says nothing about simultaneous boxes that do not overlap in space', () => {
    const a = box({ path: 'sections[0].caption', x: 0, y: 100, startSec: 0, endSec: 5 });
    const b = box({ path: 'sections[1].caption', x: 0, y: 600, startSec: 0, endSec: 5 });

    expect(collisionWarnings([a, b])).toEqual([]);
  });

  it('reports boxes that overlap in space and time at once', () => {
    const a = box({ path: 'sections[0].caption', x: 100, y: 500, startSec: 0, endSec: 5 });
    const b = box({ path: 'sections[1].caption', x: 150, y: 510, startSec: 2, endSec: 7 });

    const warnings = collisionWarnings([a, b]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_collision');
    // Overlap window is [max(0,2), min(5,7)] = [2, 5] = 3.0s, not 2.0s.
    expect(warnings[0].message).toContain('3.0');
  });

  it('reports each pair once, not twice', () => {
    const a = box({ path: 'sections[0].caption', startSec: 0, endSec: 5 });
    const b = box({ path: 'sections[1].caption', startSec: 0, endSec: 5 });

    expect(collisionWarnings([a, b])).toHaveLength(1);
  });
});
