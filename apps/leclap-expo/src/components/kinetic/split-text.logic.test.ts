import { splitWords, splitLines, staggerDelay } from '@/src/components/kinetic/split-text.logic';

describe('splitWords', () => {
  it('splits on whitespace and drops empties', () => {
    expect(splitWords('Drink and Code')).toEqual(['Drink', 'and', 'Code']);
  });

  it('collapses runs of whitespace and trims', () => {
    expect(splitWords('  Drink   \t Code  ')).toEqual(['Drink', 'Code']);
  });

  it('returns an empty array for a blank string', () => {
    expect(splitWords('   ')).toEqual([]);
  });
});

describe('splitLines', () => {
  it('splits on explicit newlines', () => {
    expect(splitLines('DRINK\n& CODE')).toEqual(['DRINK', '& CODE']);
  });

  it('keeps a single line intact', () => {
    expect(splitLines('DRINK & CODE')).toEqual(['DRINK & CODE']);
  });
});

describe('staggerDelay', () => {
  it('scales linearly with the index', () => {
    expect(staggerDelay(0, 60)).toBe(0);
    expect(staggerDelay(3, 60)).toBe(180);
  });

  it('never returns a negative delay', () => {
    expect(staggerDelay(-2, 60)).toBe(0);
  });
});
