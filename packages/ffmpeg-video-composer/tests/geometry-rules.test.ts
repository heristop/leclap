import { describe, it, expect } from 'vitest';
import {
  overflowWarnings,
  legibilityWarnings,
  collisionWarnings,
  contrastWarnings,
  footageLegibilityWarnings,
} from '@/services/geometry/rules';
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
    fontSize: 40,
    startSec: 0,
    endSec: 5,
    approx: false,
    color: null,
    backdrop: null,
    // Defaults to "handled" so a test exercising an unrelated rule never trips the footage rule
    // by accident; the contrast/footage describe blocks below override this explicitly.
    legibilityAid: true,
    ...overrides,
  };
}

describe('overflowWarnings', () => {
  it('says nothing about a box inside the frame', () => {
    expect(overflowWarnings([box()], canvas)).toEqual([]);
  });

  it('reports a box that crosses the title-safe margin while staying inside the frame', () => {
    const warnings = overflowWarnings([box({ x: 10, width: 1260 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_overflow');
    expect(warnings[0].severity).toBe('warn');
  });

  it('reports a box running off the right edge', () => {
    const warnings = overflowWarnings([box({ x: 1200, width: 300 })], canvas);

    expect(warnings[0].code).toBe('text_out_of_frame');
  });

  it('stays quiet about a sub-pixel excess instead of reporting "overflows ... by 0px"', () => {
    // Flush against the left title-safe margin and four tenths of a pixel past the right one — the
    // measurement's own noise, which rounding turned into a finding whose text said the excess was
    // zero.
    const margin = canvas.width * 0.05;

    expect(overflowWarnings([box({ x: margin, width: canvas.width - margin * 2 + 0.4 })], canvas)).toEqual([]);
  });

  it('flags text that clears the safe margin on one side even though it fits the safe width', () => {
    // 1140px inside a 1152px safe width, but pinned at the engine's absolute 80px left margin, so it
    // reaches 1220 — four pixels past the right margin at 1216. A width-only rule says nothing.
    const warnings = overflowWarnings([box({ x: 80, width: 1140 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_overflow');
  });

  it('prefers the out-of-frame finding over the softer safe-area one', () => {
    // 40 + 1300 = 1340 on a 1280-wide frame: 60px of it is not on screen at all, which is worse than
    // — and hides — the title-safe margin it also crosses.
    const warnings = overflowWarnings([box({ x: 40, width: 1300 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_out_of_frame');
    expect(warnings[0].message).toContain('60px');
  });

  it('carries the approximate flag through to the warning', () => {
    const warnings = overflowWarnings([box({ x: 40, width: 1300, approx: true })], canvas);

    expect(warnings[0].approx).toBe(true);
  });
});

describe('legibilityWarnings', () => {
  it('accepts type at a readable size', () => {
    expect(legibilityWarnings([box({ fontSize: 40 })], canvas)).toEqual([]);
  });

  it('flags type below the readable floor', () => {
    // The floor is 2.5% of frame height: 18px on a 720px canvas.
    const warnings = legibilityWarnings([box({ fontSize: 10 })], canvas);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_too_small');
  });

  it('reads the size off the box rather than dividing the height back out', () => {
    // `height` also carries the background box's padding, so recovering the size from it would
    // report a number the author never wrote and cannot map back to their descriptor.
    const warnings = legibilityWarnings([box({ fontSize: 10, height: 10 * 1.2 + 36 })], canvas);

    expect(warnings[0].message).toContain('10px');
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

describe('contrastWarnings', () => {
  it('says nothing when either colour is missing', () => {
    expect(contrastWarnings([box({ color: null, backdrop: '#000000' })])).toEqual([]);
    expect(contrastWarnings([box({ color: '#ffffff', backdrop: null })])).toEqual([]);
  });

  it('says nothing when either colour is unparseable, rather than guessing', () => {
    expect(contrastWarnings([box({ color: '{{ accent }}', backdrop: '#000000' })])).toEqual([]);
  });

  it('says nothing about text that clears the 3:1 floor', () => {
    expect(contrastWarnings([box({ color: '#f5f5f0', backdrop: '#141416' })])).toEqual([]);
  });

  it('flags text below the 3:1 floor, carrying both colours and the ratio', () => {
    const warnings = contrastWarnings([box({ path: 'sections[0].caption', color: '#333333', backdrop: '#1a1a1a' })]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_low_contrast');
    expect(warnings[0].severity).toBe('warn');
    expect(warnings[0].message).toBe('sections[0].caption: #333333 on #1a1a1a — contrast 1.4:1, below the 3:1 minimum');
  });

  it('is never approximate, regardless of the box own approx flag', () => {
    const warnings = contrastWarnings([box({ color: '#333333', backdrop: '#1a1a1a', approx: true })]);

    expect(warnings[0].approx).toBe(false);
  });
});

describe('footageLegibilityWarnings', () => {
  it('says nothing when the backdrop is known', () => {
    expect(footageLegibilityWarnings([box({ backdrop: '#141416', legibilityAid: false })])).toEqual([]);
  });

  it('says nothing when a box, shadow or outline already handles it', () => {
    expect(footageLegibilityWarnings([box({ backdrop: null, legibilityAid: true })])).toEqual([]);
  });

  it('flags text over an unknown backdrop with no box, shadow or outline', () => {
    const warnings = footageLegibilityWarnings([
      box({ path: 'sections[1].caption', backdrop: null, legibilityAid: false }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('text_unreadable_over_footage');
    expect(warnings[0].severity).toBe('warn');
    expect(warnings[0].approx).toBe(false);
    expect(warnings[0].message).toBe(
      'sections[1].caption: drawn over footage with no box, shadow or outline — legibility depends on the clip'
    );
  });
});
