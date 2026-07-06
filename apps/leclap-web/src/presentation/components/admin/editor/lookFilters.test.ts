import { describe, it, expect } from 'vitest';
import { pruneGrade, gradeFilter, lookFilter } from './lookFilters';

describe('pruneGrade', () => {
  it('drops slider fields at their defaults', () => {
    expect(pruneGrade({ brightness: 0, contrast: 1, saturation: 1.4 })).toEqual({ saturation: 1.4 });
    expect(pruneGrade({ brightness: 0, contrast: 1 })).toBeUndefined();
  });

  it('keeps a meaningful colorBalance and curvesPreset', () => {
    const grade = {
      colorBalance: { shadows: { r: 0.2, g: 0, b: -0.1 } },
      curvesPreset: 'vintage',
    };
    expect(pruneGrade(grade)).toEqual(grade);
  });

  it('drops an all-zero colorBalance', () => {
    expect(
      pruneGrade({ colorBalance: { shadows: { r: 0, g: 0, b: 0 }, midtones: { r: 0, g: 0, b: 0 } } })
    ).toBeUndefined();
  });

  it('drops only the all-zero ranges, keeping the live ones', () => {
    const pruned = pruneGrade({
      colorBalance: { shadows: { r: 0, g: 0, b: 0 }, highlights: { r: 0, g: 0.3, b: 0 } },
    });
    expect(pruned).toEqual({ colorBalance: { highlights: { r: 0, g: 0.3, b: 0 } } });
  });

  it('drops an empty curvesPreset', () => {
    expect(pruneGrade({ curvesPreset: '' })).toBeUndefined();
    expect(pruneGrade({ curvesPreset: '', saturation: 2 })).toEqual({ saturation: 2 });
  });
});

describe('gradeFilter / lookFilter', () => {
  it('returns none for empty inputs', () => {
    expect(gradeFilter(undefined)).toBe('none');
    expect(lookFilter(undefined)).toBe('none');
    expect(lookFilter('unknown-look')).toBe('none');
  });

  it('builds a CSS filter from grade fields', () => {
    const css = gradeFilter({ contrast: 1.2, hue: 30 });
    expect(css).toContain('contrast(1.2)');
    expect(css).toContain('hue-rotate(30deg)');
  });
});
