import { describe, expect, it } from 'vitest';
import { alignJustify } from './kinetic-heading.logic';

describe('alignJustify', () => {
  it('maps left to justify-start', () => {
    expect(alignJustify('left')).toBe('justify-start');
  });

  it('maps center to justify-center', () => {
    expect(alignJustify('center')).toBe('justify-center');
  });

  it('maps responsive to centered on mobile, left at lg+', () => {
    expect(alignJustify('responsive')).toBe('justify-center lg:justify-start');
  });
});
